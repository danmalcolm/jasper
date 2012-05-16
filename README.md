# Jasper

## Introduction

Jasper is a JavaScript parser micro-framework. It allows you to define a parser directly in JavaScript code, which can then be used to consume text input.

This started out as a port of the extremely clever Sprache Tiny C# Parser Framework http://code.google.com/p/sprache/. I thought it would be a useful way to get 
my head around its functional compositional magic.

Right now, this project is intended purely for fun and is not intended for use in a production scenario.

## Demos

Example of a basic XML parser:

var xmlParser = (function () {
	
		var parse = Jasper.parse;

		// valid node name
		var identifier = parse.sequence([parse.letter().once(), parse.any(parse.letter(), parse.digit(), parse.character('_-')).many().text()]).text();

		var ws = parse.whiteSpace().atLeastOnce();

		var quotedContent = parse.sequence(['"', parse.characterExcept('"').many().text(), '"'], function (open, content, close) {
			return content;
		});

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
			return { name: tag.name,attributes: tag.attributes,childNodes: children };
		})
			.then(function (result) {
				return closingTag(result.value.name).map(function (closing) {
					return result.value;
				});
			});

		// Parse root node
		return node;
	})();

	var node = xmlParser.parse('<test a="123" b="456" />'); // gives us a node object with properties name, attributes and childNodes.
	
## License

NHQueryRecorder is ©2012 Dan Malcolm and contributors under the BSD license. See https://github.com/danmalcolm/Jasper/blob/master/LICENCE.txt.