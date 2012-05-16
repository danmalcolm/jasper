beforeEach(function () {

	var process = Jasper.process;

	var f = JSON.stringify; // format objects
	this.addMatchers({
		toSucceed: function (text, expectedValue) {
			var parser = this.actual;
			var result = process(text, parser);
			this.message = function () {
				var message = "Expected to succeed parsing input "
            + f(text) + " with value " + f(expectedValue) + " but result was: " + f(result);
				if (!result.success) {
					message += ". Message: " + result.message() + ", Expectations: " + result.expectations();
				}
				return message;
			};
			return result.success && this.env.equals_(result.value, expectedValue);
		},
		toFail: function (text) {
			var parser = this.actual;
			var result = process(text, parser);
			this.message = function () {
				return "Expected to fail parsing input "
            + f(text) + " but result was: " + f(result);
			};
			return !result.success;
		},
		toFailWithReason: function (text, expectedMessage, expectedExpectations) {
			var parser = this.actual;
			var result = process(text, parser);
			var actualMessage = "", actualExpectations = "";
			if (!result.success) {
				actualMessage = result.message();
				actualExpectations = result.expectations();
			}
			this.message = function () {
				var message = "Expected to fail";
				if (expectedMessage) {
					message += " with message " + f(expectedMessage);
				}
				if (expectedExpectations) {
					message += (expectedMessage ? " and" : " with");
					message += "expectations " + f(expectedExpectations);
				}
				message += " when parsing input " + f(text) + " but result was: "
            + f(result) + " with message " + f(actualMessage)
            + " and expectations: " + f(actualExpectations);
				return message;
			};
			return !result.success
          && (!expectedMessage || actualMessage == expectedMessage)
          && (!expectedExpectations || actualExpectations == expectedExpectations);
		},
		toContainOnly: function (models) {
			var collection = this.actual;
			return collection.length === models.length && _.all(collection, function (model) {
				return _.include(models, model);
			});
		}
	});
});