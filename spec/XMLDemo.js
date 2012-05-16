describe("XML Demo", function () {
	var xmlParser = (function () {
		var parse = Jasper.parse;

		// valid node name
		var identifier = parse.using(function() {
			var first = parse.letter().once(),
				rest = parse.any(parse.letter(), parse.digit(), parse.char('_-')).many().text();
			return parse.sequence([first, rest]).text();
		});

		var ws = parse.whiteSpace().atLeastOnce();

		var quotedContent = parse.sequence(['"', parse.charExcept('"').many().text(), '"'], 1);

		var attribute = parse.sequence([identifier, '=', quotedContent], function (name, eq, value) {
			return { name: name, value: value };
		});

		var attributes = attribute.separated(ws).token();

		var openingTag = parse.sequence(['<', identifier, attributes, '>'],
			function (open, name, attrs, close) {
				return { name: name, attributes: attrs };
			});

		var closingTag = function (name) {
			return parse.sequence([parse.string('</'), parse.string(name), parse.string('>')]).named('"' + name + '" closing tag');
		};

		var node = parse.any(parse.ref(function () { return selfClosingNode; }), parse.ref(function () { return fullNode; }));

		var childNodes = node.many();

		var selfClosingNode = parse.sequence(['<', identifier, attributes, parse.string('/>')],
			function (open, name, attrs, close) {
				return { name: name, attributes: attrs, childNodes: [] };
			});

		var fullNode = parse.sequence([openingTag, childNodes], function (tag, children) {
			return { name: tag.name, attributes: tag.attributes, childNodes: children };
		})
			.then(function (result) {
				return closingTag(result.value.name).map(function (closing) {
					return result.value;
				});
			});

		// Parse root node
		return node;
	})();



	describe("XML", function () {

		describe("self closing nodes", function () {

			it("simple", function () {
				expect(xmlParser).toSucceed('<test/>', { name: 'test', attributes: [], childNodes: [] });
				expect(xmlParser).toSucceed('<test />', { name: 'test', attributes: [], childNodes: [] });
			});

			it("with attributes", function () {
				expect(xmlParser).toSucceed('<test a="123" />', { name: 'test', attributes: [{ name: 'a', value: '123'}], childNodes: [] });
				expect(xmlParser).toSucceed('<test a="123" b="456" />', { name: 'test', attributes: [{ name: 'a', value: '123' }, { name: 'b', value: '456'}], childNodes: [] });
			});

		});

		describe("full nodes", function () {

			it("simple", function () {
				expect(xmlParser).toSucceed('<test></test>', { name: 'test', attributes: [], childNodes: [] });
				expect(xmlParser).toSucceed('<test ></test>', { name: 'test', attributes: [], childNodes: [] });
			});

			it("with attributes", function () {
				expect(xmlParser).toSucceed('<test a="123"></test>', { name: 'test', attributes: [{ name: 'a', value: '123'}], childNodes: [] });
				expect(xmlParser).toSucceed('<test a="123" b="456" ></test>', { name: 'test', attributes: [{ name: 'a', value: '123' }, { name: 'b', value: '456'}], childNodes: [] });
			});

			it("with child nodes", function () {
				expect(xmlParser).toSucceed('<test a="123"><children><child></child><child></child></children></test>', { name: 'test', attributes: [{ name: 'a', value: '123'}], childNodes: [{ name: 'children', attributes: [], childNodes: [{ name: 'child', attributes: [], childNodes: [] }, { name: 'child', attributes: [], childNodes: []}]}] });
				expect(xmlParser).toSucceed('<test a="123" b="456" ></test>', { name: 'test', attributes: [{ name: 'a', value: '123' }, { name: 'b', value: '456'}], childNodes: [] });
			});

		});




	});

});