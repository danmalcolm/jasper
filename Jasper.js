var Jasper = (function () {

	var is = {
		array: Array.isArray || function (val) {
			var str = toString.call(val);
			return str == "[object Array]";
		},
		regExp: function (val) {
			var str = toString.call(val);
			return str == '[object RegExp]';
		},
		string: function (val) {
			var str = toString.call(val);
			return str == '[object String]';
		},
		number: function (val) {
			var str = toString.call(val);
			return str == '[object Number]';
		},
		fn: function (val) {
			var str = toString.call(val);
			return typeof (val) == 'function' || str == '[object Function]';
		},
		parser: function (val) {
			return val instanceof Parser;
		}
	};

	var slice = Array.prototype.slice;

	// Returns a value based on the first argument. If it is not a function, the value is returned.
	// If it is a function, calls it with any subsequent parameters
	var getValue = function () {
		var val = arguments[0];
		return is.fn(val) ? val.apply(null, slice.call(arguments, 1)) : val;
	};

	// Returns a parser based on the first argument, either:
	// - the value of the argument if it is a parser
	// - the result of calling parse.character with the argument if it is a string
	// - the result of calling parse.ref if it is a function (function is expected to return a parser)
	var getParser = function () {
		var val = arguments[0];
		if (is.parser(val)) {
			return val;
		} else if (is.string) {
			return parse.char(val);
		} else if (is.fn) {
			return ref(fn);
		} else {
			throw new Error("Expected a parser, string or function");
		}
	};

	// extends an object with the properties
	var ext = function (obj, props) {
		for (var prop in props) {
			obj[prop] = props[prop];
		}
		return obj;
	};

	var charUtil = {
		isUpper: function (c) {
			return c >= "A" && c <= "Z";
		},
		isLower: function (c) {
			return c >= "a" && c <= "z";
		},
		isDigit: function (c) {
			return c >= "0" && c <= "9";
		},
		isWhiteSpace: function (c) {
			return /\s/g.test(c);
		}
	};

	// Contains text being parsed and position within it	
	var Input = function (text, at, line, column) {
		this.text = text;
		this.at = at || 0;
		this.line = line || 1;
		this.column = column || 1;
		this.current = this.text.charAt(at);
		this.atEnd = (this.at === this.text.length);
	};
	ext(Input.prototype, {
		next: function () {
			if (this.atEnd)
				throw new Error("Cannot advance beyond end of text");
			var newLine = this.current === '\n';
			var at = this.at + 1;
			var line = newLine ? this.line + 1 : this.line;
			var column = newLine ? 1 : this.column + 1;
			return new Input(this.text, at, line, column);
		},
		// shows the current line following by another line with a caret indicating the current position 
		visualSummary: function () {
			var line = this.text.split('\n')[this.line - 1];
			var indicator = new Array(this.column).join('-') + '^';
			return line + '\n' + indicator;
		}
	});

	// Results - contain outcome of parsing
	var ifSuccess = function (result, fn) {
		return result.success ? fn(result) : result;
	};
	var ifFailure = function (result, fn) {
		return !result.success ? fn(result) : result;
	};
	var Success = function (remaining, value) {
		this.remaining = remaining;
		this.success = true;
		this.value = value;
	};
	ext(Success.prototype, {
		message: function () {
			return 'Parsing succeeded:\n' + this.value;
		}
	});

	// Result when input does not match parser
	var Failure = function (input, reason, expectations) {
		this.failedInput = input;
		this.success = false;
		// reason and expectations are created lazily
		this.reason = reason;
		this.expectations = expectations;
	};
	ext(Failure.prototype, {
		expectationsSummary: function () {
			return this.expectations ? this.expectations().join(" or ") : "Not specified";
		},
		message: function () {
			var input = this.failedInput;
			return 'Parsing failed - ' + this.reason() + ' at line ' + input.line + ', column: ' + input.column + ':\n' + this.failedInput.visualSummary() + '\nExpected: ' + this.expectations();
		}
	});

	var succeed = function (value, remaining) {
		return new Success(remaining, value);
	};

	var fail = function (input, reason, expectations) {
//		var result = new Failure(input, reason, expectations);
//		console.log(result.message());
//		return result;
		return new Failure(input,reason,expectations);
	};

	// Parser - provides a container for core parse function, using prototypal inheritance to attach combinators
	var Parser = function (fn) {
		this.fn = fn;
	};
	ext(Parser.prototype, {
		parse: function (input) {
			return this.fn(input);
		},
		// Creates a new parser that first parses the input using the current parser function,
		// then performs further parsing on the result with a new parser function
		combine: function (callback) {
			var func = this.fn;
			var combined = function (input) {
				var result = func(input);
				return callback(input, result);
			};
			return createParser(combined);
		},
		// Creates a new parser that first parses the input using the current parser function,
		// then, if successful, performs further parsing with a new parser function
		combineIfSuccess: function (callback) {
			return this.combine(function (input, result) {
				return ifSuccess(result, callback);
			});
		},
		map: function (map) {
			return this.combine(function (input, result) {
				return ifSuccess(result, function (r) {
					var mappedValue = map(r.value);
					return succeed(mappedValue, r.remaining);
				});
			});
		},
		// Attempts to parse using the current parser and, if it fails,
		// tries each additional parser argument in sequence
		or: function () {
			var parser = this;
			for (var i = 0, l = arguments.length; i < l; i++) {
				parser = (function (other) {
					return parser.combine(function (input, result1) {
						if (result1.success) {
							return result1;
						} else {
							var result2 = other.parse(input);
							if (!result2.success) {
								return fail(result1.failedInput, result1.reason,
								function () {
									return [].concat(result1.expectations(), result2.expectations());
								});
							} else {
								return result2;
							}
						}
					});
				})(getParser(arguments[i]));
			}
			return parser;
		},
		// Attempts to parse using the current parser and, if it fails,
		// tries each additional parser argument in turn. The first parsed 
		// character will determine the parser chosen. If any  parser 
		// fails after consuming input, the other parsers will not attempt to parse. 
		xor: function () {
			var parser = this;
			for (var i = 0, l = arguments.length; i < l; i++) {
				parser = (function (other) {
					return parser.combine(function (input, result1) {
						if (result1.success) {
							return result1;
						}
						else if (result1.failedInput !== input) {
							return result1;
						}
						else {
							var result2 = other.parse(input);
							if (!result2.success) {
								return fail(result1.failedInput, result1.reason,
								function () {
									return [].concat(result1.expectations(), result2.expectations());
								});
							}
							else {
								return result2;
							}
						}
					});
				})(getParser(arguments[i]));
			}
			return parser;
		},
		// Attempts to parse using the current parser and, if it fails,
		// succeeds without consuming input, returning the specified value
		// equivalent to .or(parse.value('some default default'))
		optional: function (val) {
			return this.or(parse.ret(val));
		},

		// Parses the end of the input, failing if not at end
		end: function () {
			return this.combineIfSuccess(function (result) {
				return result.remaining.atEnd ? result : fail(result.remaining, "Expected end of input");
			});
		},
		// Returns a new parser that first parses the input using the current parser function.
		// If successful, uses the next parser to continue processing the remaining input. The
		// next parser can be supplied directly, or via a function, which will be called with
		// the result of this parser.  
		then: function (next) {
			return this.combineIfSuccess(function (result) {
				var nextParser = getValue(next, result);
				return nextParser.parse(result.remaining);
			});
		},
		// Names part of the parser for use in failure message
		named: function (name) {
			var parser = this;
			return createParser(function (input) {
				var result = parser.parse(input);
				return ifFailure(result, function () {
					return fail(result.failedInput, result.reason, function () {
						return [name];
					});
				});
			});
		},
		// Parses zero or more elements from the input
		many: function () {
			var parser = this;
			return createParser(function (input) {
				var results = [];
				var result = parser.parse(input);
				var remaining = input;
				while (result.success) {
					results.push(result.value);
					remaining = result.remaining;
					result = parser.parse(remaining);
				}
				// always succeeds (zero or more)
				return succeed(results, remaining);
			});
		},
		// Parses zero or more elements, each interspersed by a separator element. 
		// The following options are available:
		// include: bool - determines whether separator elements are included in the result of the parser
		separated: function (separator, options) {
			options || (options = {});
			var current = this;

			var add = options.include ?
			function (arr, pair) { arr.push(pair.sep, pair.el); }
			: function (arr, pair) { arr.push(pair.el); };

			return current.once()
			.then(function (first) {
				return parse.sequence([separator, current], function (sep, el) {
					return { sep: sep, el: el };
				}).many().map(function (pairs) {
					var els = [];
					els.push(first.value[0]);
					for (var i = 0, l = pairs.length; i < l; i++) {
						add(els, pairs[i]);
					}
					return els;
				});
			}).optional([]);
		},
		// Parses a single element and returns the element in a single-length array
		once: function () {
			return this.map(function (value) {
				return [value];
			});
		},
		// Parses a sequence of elements requiring at least one to succeed
		atLeastOnce: function () {
			var parser = this;
			return this.once().then(function (result) {
				return parser.many().map(function (value) {
					var seq = result.value;
					seq.push.apply(seq, value); // append elements to single item array from once
					return seq;
				});
			});
		},
		xMany: function () {
			throw "Not implementd";
		},
		// Parses the element, embedded in any amount of whitespace characters
		token: function () {
			var parser = this;
			return parse.sequence([parse.whiteSpace().many(), parser, parse.whiteSpace().many()], function (before, token, after) {
				return token;
			});
		},
		// Projects result containing a sequence of characters to a string by concatenating the elements
		text: function () {
			return this.map(function (val) {
				if (!is.array(val)) {
					throw "Expected result to contain an array but was " + toString.call(val) + ". text can only be used with parsers that return a sequence of strings";
				}
				return val.join("");
			});
		},
		// Concatenates 2 streams of elements
		concat: function (other) {
			throw "Not implemented";
		},
		// Parses only if the other parser fails
		except: function (other) {
			throw "Not implemented";
		},
		// Parses a sequence of elements until the other parser succeeds
		until: function (other) {
			throw "Not implemented";
		},
		// Succeeds if the parsed value matches the predicate
		where: function (test) {
			throw "Not implemented";
		}
	});

	var createParser = function (func) {
		return new Parser(func);
	};

	// Core parser functions
	var parse = ext({}, {
		'char': function (test, expectation) {
			var predicate;
			if (is.fn(test)) {
				predicate = test;
			} else if (is.string(test)) {
				predicate = function (c) {
					return test.indexOf(c) >= 0;
				};
				expectation = expectation || (test.length === 1 ? 'the character: ' : 'one of the following characters: ') + '"' + test + '"';
			} else {
				throw new Error("Expected function or string");
			}
			return createParser(function (input) {
				if (input.atEnd) {
					return fail(input,
						function () { return "Did not expect to be at end of input"; },
						function () { return [expectation]; });
				}
				if (predicate(input.current)) {
					return succeed(input.current, input.next());
				} else {
					return fail(input,
						function () { return "Unexpected character '" + input.current + "'"; },
						function () { return [expectation]; });
				}
			});
		},
		anyChar: function () {
			return parse.char(function () {
				return true;
			}, "any character");
		},
		charExcept: function (except, expectation) {
			var test;
			if (is.fn(except)) {
				test = function (c) { return !except(c); };
			} else if (is.string(except)) {
				expectation || (expectation = 'any character expect one of the following "' + except + '"');
				test = function (c) { return c !== except; };
			} else {
				throw new Error("Expected function or string");
			}
			return parse.char(test, expectation);
		},
		letter: function () {
			return parse.char(function (c) {
				return charUtil.isUpper(c) || charUtil.isLower(c);
			}, 'a letter');
		},
		lower: function () {
			return parse.char(charUtil.isLower);
		},
		upper: function () {
			return parse.char(charUtil.isUpper);
		},
		digit: function () {
			return parse.char(charUtil.isDigit, 'a digit');
		},
		whiteSpace: function () {
			return parse.char(charUtil.isWhiteSpace);
		},
		string: function (str) {
			var parser = parse.ret("");
			for (var i = 0, l = str.length; i < l; i++) {
				(function (index) {
					parser = parser.then(function (r1) {
						return parse.char(str.charAt(index)).map(function (r2) {
							return r1.value + r2;
						});
					});
				})(i);
			}
			parser = parser.named('the string "' + str + '"');
			return parser;
		},
		// Parses a whole number
		number: function () {
			// TODO - unicode?
			return parse.digit().atLeastOnce().named("number").text();
		},
		decimal: function () {
			var parseIntegral = parse.number();
			var parseFraction = parse.char(".").then(function () {
				return parse.number().map(function (num) {
					return "." + num;
				});
			}).or(parse.ret(""));
			return parse.sequence([parseIntegral, parseFraction], function (integral, fraction) {
				return integral + fraction;
			}).named("decimal");
		},
		end: function () {
			return createParser(function (input) {
				if (!input.atEnd) {
					return fail(input, "Expected to be at end of input");
				}
				return succeed("", input);
			});
		},
		// Succeeds without consuming input and returns the specified value
		ret: function (val) {
			return createParser(function (input) {
				return succeed(val, input);
			});
		},
		// Attempts to parse using any of the parsers, trying one at a time in the order supplied
		any: function () {
			if (arguments.length === 0) {
				throw new Error("At least one argument expected");
			}
			var parser = getParser(arguments[0]);
			return parser.or.apply(parser, slice.call(arguments, 1));
		},
		// Attempts to parse using any of the parsers, trying one at a time in the order supplied,
		// the first parser to consume input will be used
		xany: function () {
			if (arguments.length === 0) {
				throw new Error("At least one argument expected");
			}
			var parser = getParser(arguments[0]);
			return parser.xor.apply(parser, slice.call(arguments, 1));
		},
		// Executes a sequence of parsers, The optional map argument can be either:
		// - a function that is called to get the resulting value. It will be called with
		// the result of each parser in the sequence, each as a separate argument
		// - a number specifying the index of a parser in the sequence. The result will be
		// a single value in the result from this parser
		// - an array, specifying the indices of parsers in the sequence. The result will be
		// an array containing the values returned by these parses
		sequence: function (parsers, map) {
			var parser, current, i, l;
			if (!is.array(parsers)) {
				throw new Error("parsers arg should be an array");
			}
			for (i = 0, l = parsers.length; i < l; i++) {
				current = getParser(parsers[i]);
				if (!parser) {
					parser = current.map(function (value) {
						return [value];
					});
				}
				else {
					var func = (function (p) {
						return function (result) {
							return p.map(function (value) {
								var array = result.value;
								array.push(value);
								return array;
							});
						};
					})(current);
					parser = parser.then(func);
				}
			}
			// combine map function if specified
			var fn;
			if (map) {
				if (is.fn(map)) {
					fn = function (values) {
						return map.apply(null, values);
					};
				} else if (is.number(map)) {
					fn = function (values) {
						return values[map];
					};
				} else if (is.array(map)) {
					fn = function (values) {
						var subset = [];
						for (i = 0, l = map.length; i < l; i++)
							subset.push(values[map[i]]);
						return subset;
					};
				}
				if (fn)
					parser = parser.map(fn);
			}
			return parser;
		},
		// Obtains parser by calling a function. Building the parser within a function can help when
		// constructing more complex parsers, as local parser variables can be defined and combined.
		// Delaying execution via a function also resolves interdependencies.
		using: function (fn) {
			var parser;
			return createParser(function (input) {
				parser = parser || (parser = fn());
				var result = parser.parse(input);
				return result;
			});
		}
	});

	// Aliases

	// Better name for scenarios where using is used to reference another parser
	parse.ref = parse.using;
	parse.seq = parse.sequence;

	return {
		parse: parse,
		process: function (text, parser) {
			var input = new Input(text);
			var result = parser.parse(input);
			return result;
		}
	};
})();





