// Communication
(function (window, undefined) {
   // TODO: modularize these all to depollute the global namespace
   window.ajaxCount = 0;

   window.ajax = function (method, uri, data, successBlock, errorBlock) {
      var request = new XMLHttpRequest();

      request.onreadystatechange = function () {
         if (request.readyState == 4) {
            window.ajaxCount--;

            if (request.status < 400) {
               var response;

               if (request.responseXML)
                  response = request.responseXML;
               else
                  response = JSON.parse(request.response || '{}');

               if (response.error || response.errors) {
                  if (errorBlock) {
                     errorBlock(response);
                  } else {
                     window.flash('error', response.error || response.errors);
                  }
               } else if (successBlock) {
                  successBlock(response);
               }
            } else {
               // throw 4/5xx no matter what, so that the testing framework sees it.
               throw "ERROR: " + request.status + " (" + method + " " + uri + ")\n\"" + request.response + "\" ";
            }
         }
      };

      window.ajaxCount++;

      request.open(method, uri, true);
      // it confuses the server when we set content-type with no body on get/delete (no body expected)
      if (data) request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      request.send(data);
   };

   window.eatCookie = function (name) {
      var match;

      match = document.cookie.match(new RegExp(name + '=([^;]+)'));
      if (match) {
         document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
         return match[1];
      }
   };

   window.getParam = function (parameterName) {
      var regex = new RegExp(parameterName + "=([^&]*)", 'i');
      var found = window.location.search.match(regex);

      if (found)
         return decodeURIComponent(found[1]);
      else
         return null;
   };
}(window));
