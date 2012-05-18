describe("Accessor Demo", function () {

	var parser = (function () {
		
		var parse = Jasper.parse;

		// property or function name
		var identifier = parse.using(function () {
			var first = parse.letter().once();
			var rest = parse.letter().or(parse.digit()).or(parse.char('_')).many().text();
			return parse.seq([first, rest]).text();
		});

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

		var property = parse.seq([
			identifier.or(quotedString).token(),
			parse.char(":").token(),
			value.token()
		], function (key, _, val) {
			return { key: key, value: val };
		}).named("property");

		
	})();



	describe("Accessor", function () {

	});

});