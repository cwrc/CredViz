ko.components.register('credit-visualization-label-editor', {
   template: ' <header>Edit Labels</header>\
               <div data-bind="foreach: Object.keys(labels)">\
                  <div>\
                     <span data-bind="text: $data"></span>\
                     <input type="text" data-bind="value: $parent.labels[$data]"/>\
                  </div>\
               </div>',

   viewModel: function (params) {
      var self = this;

      if (!params.labels)
         throw "Must provide 'labels' parameter to credit-visualization-label-editor";

      self.labels = params.labels;
   }
});