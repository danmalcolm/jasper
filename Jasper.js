var Jasper = (function () {

	var is = {
		array: function (val) {//Array.isArray || function (val){
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
		fn: function (val) {
			var str = toString.call(val);
			return typeof (val) == 'function' || str == '[object Function]';
		},
		parser: function (val) {
			return val instanceof Parser;
		}
	};

	var slice = Array.prototype.slice;

	// returns the first argument if it is not a function, or invokes the function with any subsequent parameters
	var getValue = function () {
		var val = arguments[0];
		return is.fn(val) ? val.apply(null, slice.call(arguments, 1)) : val;
	};

	// returns the first argument if it is a parser, if it is a string creates a character parser, if it is a function
	// creates a parser using ref
	var getParser = function(){
		var val = arguments[0];
		if (is.parser(val)) {
			return val;
		} else if (is.string) {
			return character(val);
		} else if (is.fn) {
			return ref(fn);
		}
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
	var Input = function (text, at) {
		this.text = text;
		this.at = at || 0;
		this.current = this.text.charAt(at);
		this.atEnd = (this.at == this.text.length);
	};
	Input.prototype.next = function () {
		if (this.atEnd)
			throw new Error("Cannot advance beyond end of text");
		return new Input(this.text, this.at + 1);
	};

	// Result classes - contain outcome of parsing

	var Result = function () {
	};
	Result.prototype.ifSuccess = function (func) {
		return this.success ? func(this) : this;
	};
	Result.prototype.ifFailure = function (func) {
		return !this.success ? func(this) : this;
	};
	var Success = function (remaining, value) {
		this.remaining = remaining;
		this.success = true;
		this.value = value;
	};
	Success.prototype = new Result();
	Success.prototype.constructor = Success;

	var Failure = function (input, getMessage, getExpectations) {
		this.failedInput = input;
		this.success = false;
		this.getMessage = getMessage;
		this.getExpectations = getExpectations;
	};
	Failure.prototype = new Result();
	Failure.prototype.constructor = Failure;
	Failure.prototype.message = function () {
		return this.getMessage ? this.getMessage() : "Not specified";
	};
	Failure.prototype.expectations = function () {
		return this.getExpectations ? this.getExpectations().join(" or ") : "Not specified";
	};

	var succeed = function (value, remaining) {
		return new Success(remaining, value);
	};

	var fail = function (input, getMessage, getExpectations) {
		return new Failure(input, getMessage, getExpectations);
	};

	// Parser class and functions

	var Parser = function (func) {
		this.func = func;
	};
	Parser.prototype.parse = function (input) {
		return this.func(input);
	};

	// Creates a new parser that first parses the input using the current parser function,
	// then performs further parsing on the result with a new parser function
	Parser.prototype.combine = function (callback) {
		var func = this.func;
		var combined = function (input) {
			var result = func(input);
			return callback(input, result);
		};
		return createParser(combined);
	};
	// Creates a new parser that first parses the input using the current parser function,
	// then, if successful, performs further parsing with a new parser function
	Parser.prototype.combineIfSuccess = function (callback) {
		return this.combine(function (input, result) {
			return result.ifSuccess(callback);
		});
	};
	Parser.prototype.map = function (map) {
		return this.combine(function (input, result) {
			return result.ifSuccess(function (r) {
				var mappedValue = map(r.value);
				return succeed(mappedValue, r.remaining);
			});
		});
	};
	// Attempts to parse using the current parser and, if it fails,
	// tries each additional parser in sequence
	Parser.prototype.or = function () {
		var parser = this;
		for (var i = 0, l = arguments.length; i < l; i++) {
			parser = (function (other) {
				return parser.combine(function (input, result) {
					return result.success ? result : other.parse(input);
				});
			})(getParser(arguments[i]));
		}
		return parser;
	};

	// Attempts to parse using the current parse and, if it fails,
	// succeeds without consuming input, returning the specified value
	// equivalent to .or(parse.value('default'))
	Parser.prototype.optional = function (val) {
		return this.or(ret(val));
	},

	// Attempts to parse using the current parser and, if it fails,
	// tries the other. The first parsed character will determine the
	// parser chosen. If the current parser fails after consuming input,
	// the other parser will not be tried.
	Parser.prototype.xor = function (other) {
		return this.combine(function (input, result1) {
			if (result1.success) {
				return result1;
			}
			else if (result1.remaining != input) {
				return result1;
			}
			else {
				var result2 = other.parse(input);
				if (!result2.success) {
					return fail(result1.input, null, function () {
						return result1.getExpectations(); // concat
					});
				}
			}
			return result.success ? result : other.parse(input);
		});
	};
	Parser.prototype.end = function () {
		return this.combineIfSuccess(function (result) {
			return result.remaining.atEnd ? result : fail(result.remaining, "Expected end of input");
		});
	};
	// Creates a new parser that first parses the input using the current parser function.
	// If successful, uses the next parser to continue processing the remaining input. The
	// next parser can be supplied directly, or via a function, which will be called with
	// the result of this parser.  
	Parser.prototype.then = function (next) {
		return this.combineIfSuccess(function (result) {
			var nextParser = getValue(next, result);
			return nextParser.parse(result.remaining);
		});
	};

	// Names part of the grammar
	Parser.prototype.named = function (name) {
		var parser = this;
		return createParser(function (input) {
			var result = parser.parse(input);
			return result.ifFailure(function () {
				return fail(result.failedInput, result.getMessage, function () {
					return [name];
				});
			});
		});
	};
	// Parses zero or more elements from the input
	Parser.prototype.many = function () {
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
	};

	// Parses zero or more elements similar to many, each interspersed with a separator element. The following
	// options can be supplied:
	// include: bool - determines whether separator elements are included in the result of the parser
	Parser.prototype.separated = function (separator, options) {
		options || (options = {});
		var current = this;

		var add = options.include ?
			function (arr, pair) { arr.push(pair.sep, pair.el); }
			: function (arr, pair) { arr.push(pair.el); };

		return current.once()
			.then(function (first) {
				return sequence([separator, current], function (sep, el) {
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
	};

	// Parses a single element, returning an array containing the element
	Parser.prototype.once = function () {
		return this.map(function (value) {
			return [value];
		});
	};
	// Parses a sequence of elements requiring at least one to succeed
	Parser.prototype.atLeastOnce = function () {
		var parser = this;
		return this.once().then(function (result) {
			return parser.many().map(function (value) {
				var seq = result.value;
				seq.push.apply(seq, value); // append elements to single item array from once
				return seq;
			});
		});
	};
	Parser.prototype.xMany = function () {
		throw "Not implementd";
	};
	// Parses the token, embedded in any amount of whitespace characters
	Parser.prototype.token = function () {
		var parser = this;
		return sequence([whiteSpace().many(), parser, whiteSpace().many()], function (before, token, after) {
			return token;
		});
	};
	// Projects result containing a sequence of characters to a string by concatenating the elements
	Parser.prototype.text = function () {
		return this.map(function (val) {
			if (!is.array(val)) {
				throw "Expected result to contain an array but was " + toString.call(val) + ". text can only be used with parsers that return a sequence of strings";
			}
			return val.join("");
		});
	};


	// Concatenates 2 streams of elements
	Parser.prototype.concat = function (other) {
		throw "Not implemented";
	};

	// Parses only if the other parser fails
	Parser.prototype.except = function (other) {
		throw "Not implemented";
	};
	// Parses a sequence of elements until the other parser succeeds
	Parser.prototype.until = function (other) {
		throw "Not implemented";
	};
	// Succeeds if the parsed value matches the predicate
	Parser.prototype.where = function (test) {
		throw "Not implemented";
	};


	// TODO: chainoperator parsers?






	var createParser = function (func) {
		return new Parser(func);
	};

	var character = function (test, expectation) {
		var predicate;
		if (is.fn(test)) {
			predicate = test;
		} else if (is.string(test)) {
			predicate = function (c) {
				return test.indexOf(c) >= 0;
			};
			expectation = expectation || (test.length === 1 ? 'character: ' : 'one of the following characters: ') + '"' + test + '"';
		} else {
			throw new Error("Expected function or string");
		}
		return createParser(function (input) {
			if (input.atEnd) {
				return fail(input,
          function () { return "Did not expect to be at end of input"; },
          function () { return [expectation]; });
			}
			return predicate(input.current)
        ? succeed(input.current, input.next())
        : fail(input,
            function () { return "Unexpected character '" + input.current + "'"; },
            function () { return [expectation]; });
		});
	};

	var anyCharacter = function () {
		return character(function () {
			return true;
		}, "any character");
	};

	var characterExcept = function (except, expectation) {
		var test;
		if (is.fn(except)) {
			test = function (c) { return !except(c); };
		} else if (is.string(except)) {
			expectation || (expectation = 'any character expect one of the following "' + except + '"');
			test = function (c) { return c !== except; };
		} else {
			throw new Error("Expected function or string");
		}
		return character(test, expectation);
	};

	var letter = function () {
		return character(function (c) {
			return charUtil.isUpper(c) || charUtil.isLower(c);
		});
	};

	var lower = function () {
		return character(charUtil.isLower);
	};

	var upper = function () {
		return character(charUtil.isUpper);
	};

	var digit = function () {
		return character(charUtil.isDigit);
	};

	var whiteSpace = function () {
		return character(charUtil.isWhiteSpace);
	};

	var string = function (str) {
		var parser = ret("");
		for (var i = 0, l = str.length; i < l; i++) {
			(function (index) {
				parser = parser.then(function (r1) {
					return character(str.charAt(index)).map(function (r2) {
						return r1.value + r2;
					});
				});
			})(i);
		}
		parser = parser.named(str);
		return parser;
	};

	// Parses a whole number
	var number = function () {
		// TODO - unicode?
		return digit().atLeastOnce().named("number").text();
	};

	var decimal = function () {
		var parseIntegral = number();
		var parseFraction = character(".").then(function () {
			return number().map(function (num) {
				return "." + num;
			});
		}).or(ret(""));
		return sequence([parseIntegral, parseFraction], function (integral, fraction) {
			return integral + fraction;
		}).named("decimal");
	};

	var end = function () {
		return createParser(function (input) {
			if (!input.atEnd) {
				return fail(input, "Expected to be at end of input");
			}
			return succeed("", input);
		});
	};

	// Succeeds without consuming input and returns the specified value
	var ret = function (val) {
		return createParser(function (input) {
			return succeed(val, input);
		});
	};

	// Attempts to parse using any of the parsers in the order supplied
	var any = function () {
		if (arguments.length === 0) {
			throw new Error("At least one argument expected");
		}
		var parser = getParser(arguments[0]);
		return parser.or.apply(parser, slice.call(arguments, 1));
	};

	// Executes a sequence of parsers, with an optional map function 
	// that takes the sequence of results as arguments
	var sequence = function (parsers, map) {
		var parser, current;
		for (var i = 0, l = parsers.length; i < l; i++) {
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
		if (is.fn(map)) {
			parser = parser.map(function (values) {
				return map.apply(null, values);
			});
		}
		return parser;
	};

	var ref = function (reference) {
		var parser;
		return createParser(function (input) {
			parser = parser || (parser = reference());
			var result = parser.parse(input);
			return result;
		});
	};

	return {
		parse: {
			character: character,
			characterExcept: characterExcept,
			anyCharacter: anyCharacter,
			letter: letter,
			lower: lower,
			upper: upper,
			string: string,
			digit: digit,
			number: number,
			decimal: decimal,
			whiteSpace: whiteSpace,
			end: end,
			sequence: sequence,
			ret: ret,
			ref: ref,
			any: any
		},
		process: function (text, parser) {
			var input = new Input(text);
			var result = parser.parse(input);
			return result;
		}
	};
})();





