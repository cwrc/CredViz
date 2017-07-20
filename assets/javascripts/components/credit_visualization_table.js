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
                     <tr data-bind="style: {background: $parent.workTypeColors[workType]}">\
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

      if (!params.labels)
         throw "Must provide 'labels' parameter to credit-visualization-table";

      self.data = params.data;
      self.totalNumChanges = params.totalNumChanges;
      self.labels = params.labels;

      self.users = ko.pureComputed(function () {
         return self.data().reduce(function (agg, change) {
            if (!agg.find(function (user) {
                  return user.id == change.user.id;
               }))
               agg.push(change.user);
            return agg;
         }, []);
      });

      self.workTypes = Object.keys(self.labels)

      self.cleanLabel = function (workType) {
         return self.labels[workType];
      };

      self.getContributionForType = function (user, category) {
         var changes, percentage, nDecimals, decimalShifter, total;

         changes = self.data().filter(function (change) {
            return change.user.id == user.id
               && change.category == category;
         });

         console.log(changes)

         nDecimals = 1;
         decimalShifter = Math.pow(10, nDecimals);
         total = changes.reduce(function (agg, change) {
            return agg + change.weightedValue();
         }, 0);

         percentage = Math.round(
            (total / self.totalNumChanges()) * 100 * decimalShifter
         );

         return (percentage / decimalShifter) || '\u2013';
      };

      self.isBlankContribution = function (user, workType) {
         return !parseInt(self.getContributionForType(user, workType));
      };

      self.workTypeColors = self.workTypes.reduce(function (agg, workType) {
         agg[workType] = ko.observable();

         return agg;
      }, {});

      // This is done on a polling loop because the D3 graph doesn't have a conveniently accessible event here
      self.fetchWorkColors = function () {
         if (document.querySelector('svg g')) {
            for (var workType in self.workTypeColors) {
               var graphLegendItem, snakeWorkType;

               snakeWorkType = workType.toLowerCase().replace(' ', '_');

               graphLegendItem = document.querySelector('.legend-' + snakeWorkType + ' rect');

               self.workTypeColors[workType](graphLegendItem ? graphLegendItem.getAttribute('fill') : '');
            }
         } else {
            window.setTimeout(self.fetchWorkColors, 500);
         }
      };
      self.fetchWorkColors();
   }
});