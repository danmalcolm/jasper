describe("Parsing", function () {
	var parse = Jasper.parse;
	var process = Jasper.process;

	describe("parsers", function () {

		describe("when parsing single character by predicate", function () {
			var parser = parse.character(function (x) { return x == "X"; }, "the letter X");

			it("should succeed with valid input", function () {
				expect(parser).toSucceed("X", "X");
			});

			it("should fail with invalid input", function () {
				expect(parser).toFail("A");
			});

			it("should fail with failure reason and expectation", function () {
				expect(parser).toFailWithReason("A", "Unexpected character 'A'", "the letter X");
			});
		});

		describe("when parsing single character", function () {
			var parser = parse.character("X");

			it("should succeed with matching input", function () {
				expect(parser).toSucceed("X", "X");
			});

			it("should fail with anything else", function () {
				expect(parser).toFail("1");
			});
		});

		describe("when parsing single character specifying range", function () {
			var parser = parse.character("XYZ");

			it("should succeed with matching input", function () {
				expect(parser).toSucceed("X", "X");
				expect(parser).toSucceed("Z", "Z");
			});

			it("should fail with anything else", function () {
				expect(parser).toFailWithReason("1", 'Unexpected character \'1\'', 'one of the following characters: \"XYZ\"');
			});
		});

		describe("when parsing any character", function () {
			var parser = parse.anyCharacter();

			it("should succeed with any character input", function () {
				expect(parser).toSucceed("X", "X");
				expect(parser).toSucceed("1", "1");
				expect(parser).toSucceed("_", "_");
				expect(parser).toSucceed(" ", " ");
				expect(parser).toSucceed("\t", "\t");
			});

			it("should fail if at end of input", function () {
				expect(parser).toFail("", null, "Expected any character");
			});
		});

		describe("when parsing digit", function () {
			var parser = parse.digit();

			it("should succeed with valid input", function () {
				expect(parser).toSucceed("1", "1");
			});

			it("should fail with invalid input", function () {
				expect(parser).toFail("A");
			});
		});

		describe("when parsing white space", function () {
			var parser = parse.whiteSpace();

			it("should succeed with space", function () {
				expect(parser).toSucceed(" ", " ");
			});

			it("should succeed with tab", function () {
				expect(parser).toSucceed("\t", "\t");
			});

			it("should fail with non-whitespace input", function () {
				expect(parser).toFail("A");
			});
		});

		describe("when parsing letter", function () {
			var parser = parse.letter();

			it("should succeed with lowercase input", function () {
				expect(parser).toSucceed("a", "a");
			});

			it("should succeed with uppercase character", function () {
				expect(parser).toSucceed("A", "A");
			});

			it("should fail with non letter", function () {
				expect(parser).toFail("1");
			});
		});

		describe("when parsing using any from a sequence of parsers", function () {
			var parser = parse.any(parse.character('a'), parse.character('b'), parse.character('c'));

			it("should succeed with first parser", function () {
				expect(parser).toSucceed("a", "a");
			});

			it("should succeed with middle parser", function () {
				expect(parser).toSucceed("b", "b");
			});

			it("should succeed with last parser", function () {
				expect(parser).toSucceed("c", "c");
			});

			it("should fail if neither match", function () {
				expect(parser).toFail("_");
			});

		});

		describe("when parsing using any from a sequence of parsers, specified as characters", function () {
			var parser = parse.any('a', 'b', 'c');

			it("should succeed with each parser", function () {
				expect(parser).toSucceed("a", "a");
				expect(parser).toSucceed("b", "b");
				expect(parser).toSucceed("c", "c");
			});

		});

		describe("when parsing using any from a sequence of parsers, specified as functions", function () {
			var parser = parse.any(function () { return parse.character('a'); }, function () { return parse.character('b'); });

			it("should succeed with each parser", function () {
				expect(parser).toSucceed("a", "a");
				expect(parser).toSucceed("b", "b");
			});

		});

	});

	describe("combinator methods", function () {

		describe("end", function () {

			it("should match end with empty input", function () {
				var result = process("", parse.end());
				expect(result.success).toBeTruthy();
			});

			describe("when specifying end after expected input", function () {
				var parser = parse.digit().end();

				it("should succeed if at end", function () {
					expect(parser).toSucceed("1", "1");
				});

				it("should fail if not at end", function () {
					expect(parser).toFail("1a");
				});

			});

		});

		describe("map", function () {

			describe("when mapping value", function () {
				var parser = parse.digit().map(function (value) {
					return { valueProp: value };
				});

				it("should succeed with mapped value if input matches", function () {
					expect(parser).toSucceed("1", { valueProp: "1" });
				});

				it("should fail if invalid input", function () {
					expect(parser).toFail("_");
				});
			});
		});

		describe("or", function () {

			describe("when combining with additional parser", function () {
				var parser = parse.digit().or(parse.letter()).end();

				it("should succeed when first matches", function () {
					expect(parser).toSucceed("1", "1");
				});

				it("should succeed when second matches", function () {
					expect(parser).toSucceed("a", "a");
				});

				it("should fail if neither match", function () {
					expect(parser).toFail("_");
				});

				it("failure message and expectations should combine 2 parsers", function () {
					expect(parser).toFail("_", "dd", "letter or digit");
				});
			});

			describe("when combining additional 2 parsers", function () {
				var parser = parse.character('a').or(parse.character('b'), parse.character('c')).end();

				it("should succeed when first matches", function () {
					expect(parser).toSucceed("a", "a");
				});

				it("should succeed when second matches", function () {
					expect(parser).toSucceed("b", "b");
				});

				it("should succeed when last matches", function () {
					expect(parser).toSucceed("c", "c");
				});

				it("should fail if neither match", function () {
					expect(parser).toFail("_");
				});

				it("failure message and expectations should combine 2 parsers", function () {
					expect(parser).toFail("_", "dd", "letter or digit");
				});
			});
		});

		describe("then", function () {

			describe("when combining values from 2 parsers", function () {
				var parser = parse.digit().then(function (result) {
					return parse.letter().map(function (letter) { return result.value + letter; });
				}).end();

				it("should succeed with expected input", function () {
					expect(parser).toSucceed("1a", "1a");
				});

			});

			describe("when specifying next parser as argument", function () {
				var parser = parse.digit().then(parse.letter()).end();

				it("should succeed with expected input and return result from second parser only", function () {
					expect(parser).toSucceed("1a", "a");
				});

			});

			describe("when combining values from 3 parsers", function () {
				var parser = parse.digit()
          .then(function (result) {
          	return parse.letter().map(function (letter) { return result.value + letter; });
          }).then(function (result) {
          	return parse.character("_").map(function (letter) { return result.value + letter; });
          }).end();

				it("should succeed with expected input", function () {
					expect(parser).toSucceed("1a_", "1a_");
				});

			});

		});

		describe("sequence", function () {

			describe("when parsing using sequence of parsers", function () {
				var parser = parse.sequence([parse.character("1"), parse.character("2"), parse.character("3")]);

				it("should succeed with expected input, with results in array", function () {
					expect(parser).toSucceed("123", ["1", "2", "3"]);
				});

			});

			describe("when parsing using sequence of parsers specified as strings", function () {
				var parser = parse.sequence(["1", "2", "3"]);

				it("should succeed with expected input, with results in array", function () {
					expect(parser).toSucceed("123", ["1", "2", "3"]);
				});

			});

			describe("when parsing using sequence of parsers and projecting result from values", function () {
				var parser = parse.sequence([parse.character("["), parse.digit(), parse.character("]")],
          function (opening, digit, closing) {
          	return digit;
          });

				it("should succeed with expected input, with projected result", function () {
					expect(parser).toSucceed("[3]", "3");
				});

			});

		});

		describe("name", function () {

			describe("when naming parser", function () {
				var parser = parse.sequence([parse.character("["), parse.digit(), parse.character("]")])
          .named("Array index");

				it("should describe reason in expectations when parsing fails", function () {
					expect(parser).toFailWithReason("_sdf_", null, "Array index");
				});

				it("should succeed with expected input", function () {
					expect(parser).toSucceed("[3]", ["[", "3", "]"]);
				});

			});

		});

		describe("many", function () {

			describe("when parsing multiple elements", function () {
				var parser = parse.digit().many();

				it("should parse sequence of elements at start of input", function () {
					expect(parser).toSucceed("123XXX", ["1", "2", "3"]);
				});

				it("should succeed with empty result if no match found", function () {
					expect(parser).toSucceed("XXX", []);
				});

			});

		});

		describe("separated", function () {

			describe("when parsing multiple elements excluding separators", function () {
				var parser = parse.digit().separated(parse.character(','), { last: false, include: false });

				it("should parse sequence of elements at start of input", function () {
					expect(parser).toSucceed("1,2,3,4,5,XXX", ["1", "2", "3", "4", "5"]);
				});

				it("should parse single element at start of input", function () {
					expect(parser).toSucceed("1XXX", ["1"]);
				});

				it("should parse single element at start of input followed by separator", function () {
					expect(parser).toSucceed("1,XXX", ["1"]);
				});

				it("should succeed with empty result if no match found", function () {
					expect(parser).toSucceed("XXX", []);
				});

			});

			describe("when parsing multiple elements including separators", function () {
				var parser = parse.digit().separated(parse.character(','), { last: false, include: true });

				it("should parse sequence of elements at start of input omitting valid trailing separator", function () {
					expect(parser).toSucceed("1,2,3,XXX", ["1", ",", "2", ",", "3"]);
				});

				it("should parse sequence of elements at start of input omitting trailing separator", function () {
					expect(parser).toSucceed("1,2,3XXX", ["1", ",", "2", ",", "3"]);
				});

			});

		});

		describe("once", function () {

			describe("when parsing one digit", function () {
				var parser = parse.digit().once();

				it("should parse digit at start of input", function () {
					expect(parser).toSucceed("1XXX", ["1"]);
				});

				it("should fail with non matching input", function () {
					expect(parser).toFail("XXX");
				});

			});

		});

		describe("atLeastOnce", function () {

			describe("when parsing at least one digit", function () {
				var parser = parse.digit().atLeastOnce();

				it("should parse single element at start of input", function () {
					expect(parser).toSucceed("1XXX", ["1"]);
				});

				it("should parse sequence of elements at start of input", function () {
					expect(parser).toSucceed("123XXX", ["1", "2", "3"]);
				});

				it("should fail with non matching input", function () {
					expect(parser).toFail("XXX");
				});

			});

		});

		describe("atLeastOnce", function () {

			describe("when parsing at least one digit", function () {
				var parser = parse.digit().atLeastOnce();

				it("should parse single digit at start of input", function () {
					expect(parser).toSucceed("1XXX", ["1"]);
				});

				it("should parse sequence of digits at start of input", function () {
					expect(parser).toSucceed("123XXX", ["1", "2", "3"]);
				});

				it("should fail with non matching input", function () {
					expect(parser).toFail("XXX");
				});

			});
		});

		describe("token", function () {

			describe("when parsing one or more digits within white space", function () {
				var parser = parse.digit().atLeastOnce().token();

				it("should parse single digit at start of input", function () {
					expect(parser).toSucceed("  1  ", ["1"]);
				});

				it("should parse single digit with leading white space", function () {
					expect(parser).toSucceed("  1", ["1"]);
				});

				it("should parse single digit with trailing white space", function () {
					expect(parser).toSucceed("1  ", ["1"]);
				});

				it("should parse sequence of digits at start of input", function () {
					expect(parser).toSucceed("123XXX", ["1", "2", "3"]);
				});

				it("should fail with other non matching input within whitespace", function () {
					expect(parser).toFail("  XXX  ");
				});

			});
		});

		describe("text", function () {

			describe("when parsing sequence of digits as string", function () {
				var parser = parse.digit().atLeastOnce().text();

				it("should parse single digit at start of input", function () {
					expect(parser).toSucceed("1", "1");
				});

				it("should convert sequence of digits to string", function () {
					expect(parser).toSucceed("123456", "123456");
				});

				it("should fail with invalid input", function () {
					expect(parser).toFail("XXX");
				});
			});

		});

		describe("string", function () {

			describe("when parsing string", function () {
				var parser = parse.string("class");

				it("should parse string at start of input", function () {
					expect(parser).toSucceed("class", "class");
				});

				it("should fail with invalid input, giving expected string as expectation", function () {
					expect(parser).toFailWithReason("XXX", null, "class");
				});
			});

		});

		describe("number", function () {

			describe("when parsing number", function () {
				var parser = parse.number();

				it("should parse single digit number", function () {
					expect(parser).toSucceed("1", "1");
				});

				it("should parse multiple digits number", function () {
					expect(parser).toSucceed("123", "123");
				});

				it("should fail with invalid input, giving expected string as expectation", function () {
					expect(parser).toFailWithReason("XXX", null, "number");
				});
			});

		});

		describe("decimal", function () {

			describe("when parsing decimal", function () {
				var parser = parse.decimal();

				it("should parse decimal without fraction", function () {
					expect(parser).toSucceed("123", "123");
				});

				it("should parse decimal with fraction", function () {
					expect(parser).toSucceed("123.456", "123.456");
				});

				it("should fail with invalid input", function () {
					expect(parser).toFailWithReason("XXX", null, "decimal");
				});
			});

		});




	});
});