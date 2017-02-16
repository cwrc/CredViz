ko.components.register('credit-visualization-table', {
   template: ' <table>\
                  <thead>\
                     <tr>\
                        <th></th>\
                        <!-- ko foreach: users -->\
                        <th data-bind="text: $data.name"></th>\
                        <!-- /ko -->\
                     </tr>\
                  </thead>\
                  <tbody data-bind="foreach: workTypes">\
                     <tr>\
                        <th data-bind="text: $parent.cleanLabel($data)"></th>\
                        <!-- ko foreach: $parent.users -->\
                           <td>%</td>\
                        <!-- /ko -->\
                     </tr>\
                  </tbody>\
               </table>',

   viewModel: function (params) {
      var self = this;

      self.data = params.data;

      self.data.subscribe(function (data) {
         console.log(data)
      });

      self.users = ko.pureComputed(function () {
         return self.data().map(function (d) {
            return d.user;
         });
      });

      self.workTypes = CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES.slice(0);
      self.cleanLabel = function (workType) {
         return CWRC.toTitleCase(workType.replace('_', ' '));
      };
   }
});