'use strict';

/* https://github.com/angular/protractor/blob/master/docs/getting-started.md */

describe('Auth', function() {

    browser.get('index.html');
    var ptor = protractor.getInstance();
    it('auth should fail when trying to connect to an unused port', function() {
        var host = ptor.findElement(protractor.By.model('host'));
        var password = ptor.findElement(protractor.By.model('password'));
        var port = ptor.findElement(protractor.By.model('port'));
        var submit = ptor.findElement(protractor.By.tagName('button'));
        // Fill out the form?
        host.sendKeys('localhost');
        password.sendKeys('password');
        port.sendKeys(2462);
        submit.click();

        var error = ptor.findElement(
            protractor.By.css('.alert.alert-danger > strong')
        )

        expect(error.getText()).toBeDefined();
    });
});
