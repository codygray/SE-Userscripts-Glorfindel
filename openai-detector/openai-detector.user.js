// ==UserScript==
// @name        Stack Exchange, OpenAI detector
// @namespace   https://github.com/Glorfindel83/
// @description Adds a button to check the probability that a post was written by a bot
// @contributor Glorfindel
// @contributor Makyen
// @contributor PurpleMagick
// @updateURL   https://raw.githubusercontent.com/Glorfindel83/SE-Userscripts/master/openai-detector/openai-detector.user.js
// @downloadURL https://raw.githubusercontent.com/Glorfindel83/SE-Userscripts/master/openai-detector/openai-detector.user.js
// @supportURL  https://stackapps.com/questions/9611/openai-detector
// @version     0.11
// @match       *://*.askubuntu.com/*
// @match       *://*.mathoverflow.net/*
// @match       *://*.serverfault.com/*
// @match       *://*.stackapps.com/*
// @match       *://*.stackexchange.com/*
// @match       *://*.stackoverflow.com/*
// @match       *://*.superuser.com/*
// @match       *://metasmoke.erwaysoftware.com/*
// @exclude     *://stackexchange.com/*
// @exclude     *://api.*
// @exclude     *://blog.*
// @exclude     *://chat.*
// @exclude     *://data.*
// @exclude     *://stackoverflow.com/jobs*
// @exclude     *://*/tour
// @exclude     *://*.stackexchange.com/questions/ask
// @exclude     *://*.stackoverflow.com/questions/ask
// @exclude     *://*.superuser.com/questions/ask
// @exclude     *://*.serverfault.com/questions/ask
// @exclude     *://*.askubuntu.com/questions/ask
// @exclude     *://*.stackapps.com/questions/ask
// @exclude     *://*.mathoverflow.net/questions/ask
// @connect     openai-openai-detector.hf.space
// @require     https://cdn.jsdelivr.net/gh/makyen/extension-and-userscript-utilities@94cbac04cb446d35dd025974a7575b25b9e134ca/executeInPage.js
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// ==/UserScript==
/* globals StackExchange, $, makyenUtilities */

(function () {
  "use strict";

  /*
   * For security reasons, Greasemonkey puts userscripts in a context other than the page
   * context.  The GM.xmlHttpRequest() function is only available in that context, not in
   * the page context.  Most of this script relies on jQuery and access to the StackExchange
   * Object.  Both of those are in the page context.  So, most of the script, everything in
   * the inPage() function, is placed in the page context.  For the page context to get the
   * detection data, an event, "OAID-request-detection-data", is dispatched with the text to
   * pass to the OpenAI detector on the button which has been clicked.  Once the data is
   * received, the "OAID-receive-detection-data" event is dispatched with the data received
   * from the OpenAI Detector.
  */

  function inPage() {
    const isMS = window.location.hostname === 'metasmoke.erwaysoftware.com';

    function updateButtonTextWithPercent(button, percent) {
      button.text(button.text().replace(/(?: \(\d+(?:\.\d+)?%\)$|$)/, ` (${percent}%)`));
    }

    function receiveOpenAIDetectionDataForButton(event) {
      const button = $(event.target);
      if (!isMS) {
        StackExchange.helpers.removeSpinner(button);
      }
      const data = JSON.parse(event.detail);
      const percent = Math.round(data.fake_probability * 10000) / 100;
      const message = `According to Hugging Face, the chance that this post was generated by OpenAI is ${percent}%`;
      if (!isMS) {
        StackExchange.helpers.showToast(message);
      }
      updateButtonTextWithPercent(button, percent);
    }
    window.addEventListener('OAID-receive-detection-data', receiveOpenAIDetectionDataForButton);

    function requestOpenAIDetectionDataForButton(button, text) {
      button.blur();
      if (!isMS) {
        StackExchange.helpers.addSpinner(button);
      }
      button[0].dispatchEvent(new CustomEvent('OAID-request-detection-data', {
        bubbles: true,
        cancelable: true,
        detail: JSON.stringify(text),
      }));
    }

    function handlePostMenuButtonClick() {
      const button = $(this);
      const postMenu = button.closest("div.js-post-menu");
      const postId = postMenu.data("post-id");
      $.get(`/posts/${postId}/edit-inline`, function(result) {
        const sourcePage = new DOMParser().parseFromString(result, "text/html");
        const textarea = sourcePage.querySelector("textarea[name='post-text']");
        const postMarkdown = textarea.value;
        requestOpenAIDetectionDataForButton(button, postMarkdown);
      });
    }

    function addButtonToPostMenu() {
      // Regular posts
      const menu = $(this);
      // Add button
      const button = $('<button class="s-btn s-btn__link SEOAID-post-menu-button" type="button" href="#">Detect OpenAI</button>');
      const cell = $('<div class="flex--item SEOAID-post-menu-item"></div>');
      cell.append(button);
      menu.children().first().append(cell);
      button.on('click', handlePostMenuButtonClick);
    }

    function addButtonToAllPostMenus() {
      $("div.js-post-menu:not(.SEOAID-post-menu-button-added)")
        .each(addButtonToPostMenu)
        .addClass("SEOAID-post-menu-button-added");
    }

    function handleMSMarkdownButtonClick() {
      const button = $(this);
      const tabContent = button.closest("div.post-body-panel-markdown");
      const postMarkdown = tabContent.children(".post-body-pre-block").html();
      requestOpenAIDetectionDataForButton(button, postMarkdown);
    }

    function addButtonToMSMarkdownTab() {
      // Regular posts
      const tabContent = $(this);
      // Add button
      const button = $('<button class="SEOAID-markdown-button" type="button" href="#">Detect OpenAI</button>');
      const cell = $('<div class="SEOAID-Markdown-button-cntainer"></div>');
      cell.append(button);
      tabContent.append(cell);
      button.on('click', handleMSMarkdownButtonClick);
    }

    function addButtonToAllMSMarkdownTabs() {
      $("div.post-body-panel-markdown:not(.SEOAID-markdown-button-added)")
        .each(addButtonToMSMarkdownTab)
        .addClass("SEOAID-markdown-button-added");
    }

    function doAddButtonToAllMSMarkdownTabsSoon() {
      setTimeout(addButtonToAllMSMarkdownTabs, 25);
    }

    if (isMS) {
      addButtonToAllMSMarkdownTabs();
      $(document)
        .on('turbolinks:load', doAddButtonToAllMSMarkdownTabsSoon)
        .ajaxComplete(doAddButtonToAllMSMarkdownTabsSoon);
    } else {
      addButtonToAllPostMenus()
      StackExchange.ready(addButtonToAllPostMenus);
      $(document).ajaxComplete(function() {
        addButtonToAllPostMenus();
        setTimeout(addButtonToAllPostMenus, 175); // SE uses a 150ms animation for SE.realtime.reloadPosts(). This runs after that.
      });
    }

    // Revisions - only attach button to revisions that have a "Source" button. Do not attach to tag only edits.
    $(".js-revision > div:nth-child(1) a[href$='/view-source']").each(function() {
      const sourceButton = $(this);

      // Add button
      const button = $('<button type="button" class="flex--item s-btn s-btn__link" title="detect OpenAI">Detect OpenAI</button>');
      const menu = sourceButton.parent();
      menu.append(button);

      button.on('click', function() {
        const linkURL = sourceButton.attr("href");
        $.get(linkURL, function(result) {
          const sourcePage = new DOMParser().parseFromString(result, "text/html");
          const text = sourcePage.body.textContent.trim();
          requestOpenAIDetectionDataForButton(button, text);
        });
      });
    });
  }
  makyenUtilities.executeInPage(inPage, true, 'OpenAI-detector-page-script');

  function receiveRequestForDataFromPage(event) {
    const text = JSON.parse(event.detail);
    detectAI(text).then((jsonData) => {
      event.target.dispatchEvent(new CustomEvent('OAID-receive-detection-data', {
        bubbles: true,
        cancelable: true,
        detail: jsonData,
      }));
    });
  }
  window.addEventListener('OAID-request-detection-data', receiveRequestForDataFromPage);

  function detectAI(text) {
    // The GM polyfill doesn't convert GM_xmlhttpRequest to a useful Promise in all userscript managers (i.e. Violentmonkey), so...
    const gmXmlhttpRequest = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : GM.xmlHttpRequest;
    const baseURL = "https://openai-openai-detector.hf.space/openai-detector";
    return new Promise((resolve, reject) => {
      gmXmlhttpRequest({
        method: "GET",
        url: `${baseURL}?${encodeURIComponent(text)}`,
        timeout: 60000, // There's no particular reason for this length, but don't want to hang forever.
        onload: resolve,
        onabort: reject,
        onerror: reject,
        ontimeout: reject,
      });
    })
      .then((response) => response.responseText, (rejectInfo) => {
        console.error('OpenAI Detector error response:', rejectInfo);
        alert(`OpenAI Detector encountered a problem getting data from ${baseURL}. The browser console may have more information.`);
      });
  }
})();
