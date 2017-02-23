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
                  <tbody data-bind="foreach: {data: workTypes, as: \'workType\'}">\
                     <tr>\
                        <th data-bind="text: $parent.cleanLabel(workType)"></th>\
                        <!-- ko foreach: {data: $parent.users, as: \'user\' } -->\
                           <td class="contribution" data-bind="text: $parents[1].getContributionForType(user, workType),\
                                                               css: {nil: $parents[1].isBlankContribution(user, workType)}"></td>\
                        <!-- /ko -->\
                     </tr>\
                  </tbody>\
               </table>',

   viewModel: function (params) {
      var self = this;

      self.data = params.filteredModifications;
      self.totalNumChanges = params.totalNumChanges;

      self.users = ko.pureComputed(function () {
         return self.data().map(function (d) {
            return d.user;
         });
      });

      self.workTypes = CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES.slice(0);
      self.cleanLabel = function (workType) {
         return CWRC.toTitleCase(workType.replace('_', ' '));
      };

      self.getContributionForType = function (user, workType) {
         var datum, percentage;

         datum = self.data().find(function (d) {
            return d.user.id == user.id;
         });

         var nDecimals = 1;
         var decimalShifter = Math.pow(10, nDecimals);

         percentage = Math.round(((datum.workflow_changes[workType] || 0) / self.totalNumChanges() ) * 100 * decimalShifter);

         return (percentage / decimalShifter) || '\u2013';
      };

      self.isBlankContribution = function (user, workType) {
         return !parseInt(self.getContributionForType(user, workType));
      }
   }
});