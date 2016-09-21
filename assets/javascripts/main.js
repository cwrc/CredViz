function creditVisualization() {
   ko.bindingHandlers.dynamicHtml = {
      init: function () {
         // Mark this as controlling its own descendants
         // so that KO doesn't try to double-bind on the initial load
         return {'controlsDescendantBindings': true};
      },

      update: function (element, valueAccessor, all, data, context) {
         ko.utils.setHtml(element, valueAccessor());

         ko.applyBindingsToDescendants(context, element);
      }
   };

   console.log('binding')

   ko.applyBindings();
}

window.addEventListener('load', creditVisualization);

window.addEventListener('error', function (msg, url, line, col, error) {
   // Try-catch is needed to avoid infinite loops.
   try {
      window.flash('error', 'The system had an internal problem.');
   } catch (e) {
      return false;
   }
});
