ko.components.register('credit-visualization-timeline', {
   template: ' <div class="scrollpane">\
                  <table class="timeline-list" >\
                     <tbody data-bind="foreach: sortedData">\
                        <tr class="change-record" data-bind="style: {background: $parent.categoryColors[$data.category]}">\
                           <td class="time" data-bind="text: $parent.cleanTime($data.timestamp)"></td>\
                           <td class="name">\
                              <a href="#" data-bind="attr: {href: $parent.userLink($data.user)}">\
                                 <span data-bind="text: $data.user.name"></span>\
                              </a>\
                           </td>\
                           <td class="category" data-bind="text: $parent.cleanLabel($data.category)"></td>\
                           <td class="document" data-bind="text: $data.document.name"></td>\
                           <td class="diff">\
                              <a href="#" data-bind="visible: $parent.hasDiff($data), \
                                                     click: function(){ $parent.viewDiff($data) }">Compare</a>\
                           </td>\
                        </tr>\
                     </tbody>\
                  </table>\
               </div>\
               <div class="diffpane popup" data-bind="visible: diffVisible">\
                  <div class="diff-content" data-bind="foreach: {data: diffData, as: \'diff\'}">\
                     <!-- ko foreach: $parent.splitLines(diff) -->\
                        <span data-bind="text: $data, \
                                         css: { \
                                           added: diff.added, \
                                           removed: diff.removed, \
                                           blank: $data == \'\'\
                                         }"></span> \
                     <!-- /ko -->\
                  </div>\
               </div>\
               <div class="overlay" data-bind="visible: diffVisible, click: clickOverlay"></div>',
   viewModel: function (params) {
      var self = this;

      if (!params.data)
         throw "Must provide 'data' parameter to credit-visualization-timeline";

      if (!params.labels)
         throw "Must provide 'labels' parameter to credit-visualization-timeline";

      self.sourceData = params.data;
      self.sortedData = ko.pureComputed(function () {
         var data;

         data = self.sourceData().sort(function (changeA, changeB) {
            return new Date(changeA.timestamp).getTime() - new Date(changeB.timestamp).getTime() ||
               changeA.user.name.localeCompare(changeB.user.name)
         });

         return data;
      });
      self.totalNumChanges = params.totalNumChanges;
      self.labels = params.labels;

      self.diffVisible = ko.observable(false);
      self.diffData = ko.observableArray();

      self.userLink = function (user) {
         // ideally, it would actually include their true URI (eg. what happens if there are 2x John Smiths)
         // but this isn't guaranteed at this time, so the best we can do is an educated guess
         return user.uri || '/users/' + user.name.toLowerCase().replace(/\s+/, '-');
      };

      self.cleanLabel = function (workType) {
         return self.labels[workType];
      };

      self.cleanTime = function (timestamp) {
         var date = new Date(timestamp);

         return date.toISOString().split('T')[0];
      };

      self.hasDiff = function (change) {
         // raw values with 1 are assumed to be tagging/meta changes
         return change.rawValue() > 1;
      };

      self.clickOverlay = function () {
         self.diffVisible(false);
      };

      self.splitLines = function (diff) {
         return diff.value.split("\n")
      };

      self.viewDiff = function (change) {
         var targetDate, previousDate, targetUri, previousUri;

         self.diffVisible(true);

         targetDate = new Date("2017-07-27T23:48:03.384Z");
         previousDate = new Date();

         targetUri = '/islandora/rest/v1/object/' + change.document.id + '/datastream/CWRC?version=' + targetDate.toISOString()
         previousUri = '/islandora/rest/v1/object/' + change.document.id + '/datastream/CWRC?version=' + previousDate.toISOString()


         ajax('get', targetUri, false, function (contentA) {
            ajax('get', previousUri, false, function (contentB) {
               var entryA, entryB, compact;

               compact = function (str) {
                  return str
                     .replace(/\r/g, '') // get rid of useless windows characters
                     .replace(/[^\S\n]+/g, ' ') // compress all horizontal whitespace
                     .replace(/\n[^\S\n]+/g, '\n') // trim starts of lines
                     .split(/\n\n+/g).map(function (paragraph) {
                        return paragraph.replace(/\n/g, ' ')
                     })
                     .join('\n\n')
                     .trim();
               };

               entryA = contentA.getElementsByTagName('ENTRY')[0];
               entryB = contentB.getElementsByTagName('ENTRY')[0];

               self.diffData(JsDiff.diffChars(compact(entryA.textContent), compact(entryB.textContent)));
            });
         });
      };

      self.categoryColors = Object.keys(self.labels).reduce(function (agg, workType) {
         agg[workType] = ko.observable();

         return agg;
      }, {});

      //// This is done on a polling loop because the D3 graph doesn't have a conveniently accessible event here
      self.fetchWorkColors = function () {
         if (document.querySelector('svg g')) {
            for (var category in self.categoryColors) {
               var graphLegendItem, snakeCategory;

               snakeCategory = category.toLowerCase().replace(' ', '_');

               graphLegendItem = document.querySelector('.legend-' + snakeCategory + ' rect');

               self.categoryColors[category](graphLegendItem ? graphLegendItem.getAttribute('fill') : '');
            }
         } else {
            window.setTimeout(self.fetchWorkColors, 500);
         }
      };
      self.fetchWorkColors();
   }
});