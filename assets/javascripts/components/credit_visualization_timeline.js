ko.components.register('credit-visualization-timeline', {
   template: ' <div class="timeline-list" data-bind="foreach: sortedData">\
                  <div class="change-record">\
                     <span class="time" data-bind="text: $parent.cleanTime($data.timestamp)"></span>\
                     <a href="#" class="name" data-bind="attr: {href: $parent.userLink($data.user)}">\
                        <span data-bind="text: $data.user.name"></span>\
                     </a>\
                     <span class="category" data-bind="text: $parent.cleanLabel($data.category)"></span>\
                  </div>\
               </div>',

   viewModel: function (params) {
      var self = this;

      if (!params.data)
         throw "Must provide 'data' parameter to credit-visualization-timeline";

      if (!params.labels)
         throw "Must provide 'labels' parameter to credit-visualization-timeline";

      self.sourceData = params.data;
      self.sortedData = ko.pureComputed(function () {
         var data;

         data = self.sourceData().reduce(function (agg, workset) {
            return agg.concat(workset.allValues());
         }, []);

         data = data.sort(function (changeA, changeB) {
            return new Date(changeA.timestamp).getTime() - new Date(changeB.timestamp).getTime() ||
               changeA.user.name.localeCompare(changeB.user.name)
         });

         console.log(data)

         return data;
      });
      self.totalNumChanges = params.totalNumChanges;
      self.labels = params.labels;

      self.userLink = function (user) {
         // ideally, it would actually include their true URI (eg. what happens if there are 2x John Smiths)
         // but this isn't guaranteed at this time, so the best we can do is an educated guess
         return user.uri || '/users/' + user.name.toLowerCase().replace(/\s+/, '-');
      };

      //self.workTypes = Object.keys(self.labels).filter(function (workType) {
      //   return params.ignoreTags.indexOf(workType) < 0 &&
      //      Object.keys(params.mergeTags).indexOf(workType) < 0;
      //});

      self.cleanLabel = function (workType) {
         return self.labels[workType];
      };

      self.cleanTime = function (timestamp) {
         var date = new Date(timestamp);

         return date.toISOString().split('T')[0];
      };


      //self.workTypeColors = self.workTypes.reduce(function (agg, workType) {
      //   agg[workType] = ko.observable();
      //
      //   return agg;
      //}, {});
      //
      //// This is done on a polling loop because the D3 graph doesn't have a conveniently accessible event here
      //self.fetchWorkColors = function () {
      //   if (document.querySelector('svg g')) {
      //      for (var workType in self.workTypeColors) {
      //         var graphLegendItem, snakeWorkType;
      //
      //         snakeWorkType = workType.toLowerCase().replace(' ', '_');
      //
      //         graphLegendItem = document.querySelector('.legend-' + snakeWorkType + ' rect');
      //
      //         self.workTypeColors[workType](graphLegendItem ? graphLegendItem.getAttribute('fill') : '');
      //      }
      //   } else {
      //      window.setTimeout(self.fetchWorkColors, 500);
      //   }
      //};
      //self.fetchWorkColors();
   }
});