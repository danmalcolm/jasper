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
					message += ".\nMessage:\n" + result.message();
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
		toFailWithReason: function (text, expectedReason, expectedExpectations) {
			var parser = this.actual;
			var result = process(text, parser);
			var actualReason = "", actualExpectations = "";
			if (!result.success) {
				actualReason = result.reason();
				actualExpectations = result.expectations();
			}
			this.message = function () {
				var message = "Expected to fail";
				if (expectedReason) {
					message += " with reason " + f(expectedReason);
				}
				if (expectedExpectations) {
					message += (expectedReason ? " and" : " with");
					message += "expectations " + f(expectedExpectations);
				}
				message += " when parsing input " + f(text) + " but result was: "
            + f(result) + " with message " + f(actualReason)
            + " and expectations: " + f(actualExpectations);
				return message;
			};
			return !result.success
          && (!expectedReason || actualReason == expectedReason)
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