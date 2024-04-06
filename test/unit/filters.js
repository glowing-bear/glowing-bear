"use strict";

import angular from "angular";

import "angular-mocks";

import "../../src/main";

describe('Filters', function() {
    beforeEach(angular.mock.module('weechat'));
    /*beforeEach(module(function($provide) {
        $provide.value('version', 'TEST_VER');
    }));*/

    it('has an irclinky filter', angular.mock.inject(function($filter) {
        expect($filter('irclinky')).not.toBeNull();
    }));

    describe('conditionalLinkify', function() {
        it('should create links from an url', angular.mock.inject(function($filter) {
            var url = 'asdf https://a.example.com/wiki/asdf_qwer_(rivi%C3%A8re) Some text.',
                link = 'asdf <a href="https://a.example.com/wiki/asdf_qwer_(rivi%C3%A8re)" target="_blank" rel="noopener noreferrer">https://a.example.com/wiki/asdf_qwer_(rivi%C3%A8re)</a> Some text.',
                result = $filter('conditionalLinkify')(url);
            expect(result).toEqual(link);        
        }));

        it('should not make emails into links', angular.mock.inject(function($filter) {
            var url = 'asdf@gmail.com',
                link = 'asdf@gmail.com',
                result = $filter('conditionalLinkify')(url);
            expect(result).toEqual(link);        
        }));

        it('convert the entire words to links', angular.mock.inject(function($filter) {
            var text = 'weechat.network.connection_timeout',
                link = 'weechat.network.connection_timeout',
                result = $filter('conditionalLinkify')(text);
            expect(result).toEqual(link);
        }));

        it('convert the entire words to links', angular.mock.inject(function($filter) {
            var text = 'http://test.com/(test)',
                link = '<a href="http://test.com/(test)" target="_blank" rel="noopener noreferrer">http://test.com/(test)</a>',
                result = $filter('conditionalLinkify')(text);
            expect(result).toEqual(link);
        }));

    });

    describe('irclinky', function() {
        it('should not mess up text', angular.mock.inject(function(irclinkyFilter) {
            expect(irclinkyFilter('foo')).toEqual('foo');
        }));

        it('should linkify IRC channels', angular.mock.inject(function(irclinkyFilter) {
            expect(irclinkyFilter('#foo')).toEqual('<a href="#" onclick="openBuffer(\'#foo\');">#foo</a>');
        }));

        it('should not mess up IRC channels surrounded by HTML entities', angular.mock.inject(function(irclinkyFilter) {
            expect(irclinkyFilter('<"#foo">')).toEqual('<"<a href="#" onclick="openBuffer(\'#foo">\');">#foo"></a>');
        }));

        it('should not touch links created by `linky`', angular.mock.inject(function($filter, DOMfilterFilter) {
            var url = 'http://foo.bar/#baz',
                link = $filter('conditionalLinkify')(url),
                result = DOMfilterFilter(link, 'irclinky').$$unwrapTrustedValue();
            expect(result).toEqual(link);
        }));
    });

    describe('inlinecolour', function() {
        it('should not mess up normal text', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('foo')).toEqual('foo');
            expect(inlinecolourFilter('test #foobar baz')).toEqual('test #foobar baz');
        }));

        it('should detect inline colours in #rrggbb format', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('#123456')).toEqual('#123456 <div class="colourbox" style="background-color:#123456"></div>');
            expect(inlinecolourFilter('#aabbcc')).toEqual('#aabbcc <div class="colourbox" style="background-color:#aabbcc"></div>');
        }));

        it('should not detect inline colours in #rgb format', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('#123')).toEqual('#123');
            expect(inlinecolourFilter('#abc')).toEqual('#abc');
        }));

        it('should detect inline colours in rgb(12,34,56) and rgba(12,34,56,0.78) format', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('rgb(1,2,3)')).toEqual('rgb(1,2,3) <div class="colourbox" style="background-color:rgb(1,2,3)"></div>');
            expect(inlinecolourFilter('rgb(1,2,3);')).toEqual('rgb(1,2,3); <div class="colourbox" style="background-color:rgb(1,2,3);"></div>');
            expect(inlinecolourFilter('rgba(1,2,3,0.4)')).toEqual('rgba(1,2,3,0.4) <div class="colourbox" style="background-color:rgba(1,2,3,0.4)"></div>');
            expect(inlinecolourFilter('rgba(255,123,0,0.5);')).toEqual('rgba(255,123,0,0.5); <div class="colourbox" style="background-color:rgba(255,123,0,0.5);"></div>');
        }));

        it('should tolerate whitespace in between numbers in rgb/rgba colours', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('rgb( 1\t, 2 ,  3 )')).toEqual('rgb( 1\t, 2 ,  3 ) <div class="colourbox" style="background-color:rgb( 1\t, 2 ,  3 )"></div>');
        }));

        it('should handle multiple and mixed occurrences of colour values', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('rgb(1,2,3) #123456')).toEqual('rgb(1,2,3) <div class="colourbox" style="background-color:rgb(1,2,3)"></div> #123456 <div class="colourbox" style="background-color:#123456"></div>');
            expect(inlinecolourFilter('#f00baa #123456 #234567')).toEqual('#f00baa <div class="colourbox" style="background-color:#f00baa"></div> #123456 <div class="colourbox" style="background-color:#123456"></div> #234567 <div class="colourbox" style="background-color:#234567"></div>');
            expect(inlinecolourFilter('rgba(1,2,3,0.4) foorgb(50,100,150)')).toEqual('rgba(1,2,3,0.4) <div class="colourbox" style="background-color:rgba(1,2,3,0.4)"></div> foorgb(50,100,150) <div class="colourbox" style="background-color:rgb(50,100,150)"></div>');
        }));

        it('should not replace HTML escaped &#123456;', angular.mock.inject(function(inlinecolourFilter) {
            expect(inlinecolourFilter('&#123456;')).toEqual('&#123456;');
        }));
    });

    describe('DOMfilter', function() {
        it('should run a filter on all text nodes', angular.mock.inject(function(DOMfilterFilter) {
            var dom = 'a<p>b<i>c<b>d</b>e<b>f</b>g</i>h</p>i',
                expected = '<span>A</span><p><span>B</span><i><span>C</span><b><span>D</span></b><span>E</span><b><span>F</span></b><span>G</span></i><span>H</span></p><span>I</span>',
                result = DOMfilterFilter(dom, 'uppercase').$$unwrapTrustedValue();
            expect(result).toEqual(expected);
        }));

        it('should pass additional arguments to the filter', angular.mock.inject(function(DOMfilterFilter) {
            var dom = '1<p>2</p>3.14159265',
                expected = '<span>1.00</span><p><span>2.00</span></p><span>3.14</span>',
                result = DOMfilterFilter(dom, 'number', 2).$$unwrapTrustedValue();
            expect(result).toEqual(expected);
        }));

        it('should never lock up like in bug #688', angular.mock.inject(function($filter, DOMfilterFilter) {
            var msg = '#crash http://google.com',
                linked = $filter('conditionalLinkify')(msg),
                irclinked = DOMfilterFilter(linked, 'irclinky');
            // With the bug, the DOMfilterFilter call ends up in an infinite loop.
            // I.e. if we ever got this far, the bug is fixed.
        }));
    });

    describe('codify', function() {
        it('should not mess up text', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('foo')).toEqual('foo');
        }));

        it('should codify single snippets', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('z `foo` z')).toEqual('z <span class="hidden-bracket">`</span><code>foo</code><span class="hidden-bracket">`</span> z');
            expect(codifyFilter('z `a` z')).toEqual('z <span class="hidden-bracket">`</span><code>a</code><span class="hidden-bracket">`</span> z');
            expect(codifyFilter('z ```foo``` z')).toEqual('z <span class="hidden-bracket">```</span><code>foo</code><span class="hidden-bracket">```</span> z');
        }));

        it('should codify multiple snippets', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('z `foo` z `bar` `baz`')).toEqual('z <span class="hidden-bracket">`</span><code>foo</code><span class="hidden-bracket">`</span> z <span class="hidden-bracket">`</span><code>bar</code><span class="hidden-bracket">`</span> <span class="hidden-bracket">`</span><code>baz</code><span class="hidden-bracket">`</span>');
        }));

        it('should not codify empty snippets', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('``')).toEqual('``');
        }));

        it('should not codify single backticks', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('foo`bar')).toEqual('foo`bar');
        }));


        it('should not codify double backticks', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('some ``non-code``')).toEqual('some ``non-code``');
        }));


        it('should not codify pseudo-fancy quotes', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('some ``fancy qoutes\'\'')).toEqual('some ``fancy qoutes\'\'');
        }));

        it('should not codify stuff in the middle of a word or URL', angular.mock.inject(function(codifyFilter) {
            expect(codifyFilter('https://foo.bar/`wat`')).toEqual('https://foo.bar/`wat`');
            expect(codifyFilter('Weird`ness`')).toEqual('Weird`ness`');
        }));

        
    });
});
