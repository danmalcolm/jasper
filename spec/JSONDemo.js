describe("JSON Demo", function () {

	var parser = (function () {
		var parse = Jasper.parse;

		var specialCharacters = {
			'b': '\b',
			'f': '\f',
			'n': '\n',
			'r': '\r',
			't': '\t',
			'v': '\v',
			'\'': '\'',
			'"': '"',
			'\\': '\\'
		};

		// parses variable, property or function name
		var identifier = parse.letter()
			.then(function (firstResult) {
				return parse.letter().or(parse.digit()).or(parse.char('_')).many().text()
				.map(function (rest) {
					return firstResult.value + rest;
				});
			});

		// parses escaped character sequence within a string - (Latin-1 \XXX \xXXX and unicode characters not supported, just a demo)
		var escaped = parse.char('\\')
			.then(function () {
				return parse.char(function (c) {
					return specialCharacters[c];
				});
			})
			.map(function (c) { return specialCharacters[c]; });

		var quotedString = parse.char('"\'')
			.then(function (open) {
				return escaped
					.or(parse.charExcept(open.value))
					.many().text()
					.then(function (textResult) {
						// balance opening quote - TODO implement until
						return parse.char(open.value).map(function (r) {
							return textResult.value;
						});
					});
			});

		var number = parse.number().map(function (s) { return Number(s); });

		var value = parse.any(quotedString, number, parse.ref(function () { return object; }), parse.ref(function () { return array; }));

		var property = parse.sequence([
			identifier.or(quotedString).token(),
			parse.char(":").token(),
			value.token()
		], function (key, _, val) {
			return { key: key, value: val };
		}).named("property");

		var properties = property.separated(parse.char(",").token());

		var array = parse.sequence([
				parse.char("[").token(),
				value.separated(parse.char(',').token()),
				parse.char(']').token()
		], function (b1, values, b2) {
			return values;
		});

		var object = parse.sequence([
			parse.char("{").named('start of object "{"').token(),
			properties,
			parse.char("}").named('end of object "}"').token()
		], function (b1, props, b2) {
			var result = {};
			for (var i = 0, l = props.length; i < l; i++) {
				result[props[i].key] = props[i].value;
			}
			return result;
		});

		// Parse root object or array
		return object.or(array);
	})();

	describe("JSON", function () {

		describe("string literals", function () {

			it("escaped opening quote", function () {
				expect(parser).toSucceed('{ a1: "123456" }', { a1: '123456' });
				expect(parser).toSucceed('{ a1: "123456\\"" }', { a1: '123456"' });
				expect(parser).toSucceed('{ a1: \'123\\\'456\' }', { a1: '123\'456' });
			});

		});

		describe("array literals", function () {

			it("array", function () {
				expect(parser).toSucceed('{ a1: ["1", "2"] }', { a1: ['1', '2'] });
			});

			it("array of objects", function () {
				expect(parser).toSucceed('{ a1: [{ a: "1", b: "2" }, { c: "3", d: "4" }] }', { a1: [{ a: '1', b: '2' }, { c: '3', d: '4'}] });
			});

		});

		describe("object", function () {

			it("string values", function () {
				expect(parser).toSucceed('{ a1: "123456" }', { a1: '123456' });
				expect(parser).toSucceed('{ a1: \'123456\' }', { a1: '123456' });
			});
			it("object with one property", function () {
				expect(parser).toSucceed('{ a1: "123456" }', { a1: '123456' });
				expect(parser).toSucceed('{ a1: 123456 }', { a1: 123456 });
			});
			it("object with multiple properties", function () {
				expect(parser).toSucceed('{ a1: "123456", a2: 123 }', { a1: '123456', a2: 123 });
			});
			it("object with nested object", function () {
				expect(parser).toSucceed('{ a1: { b1: 123, b2: "123" }, a2: 123 }', { a1: { b1: 123, b2: "123" }, a2: 123 });
			});
			it("object with no properties", function () {
				expect(parser).toSucceed('{  }', {});
			});


		});
	});

});