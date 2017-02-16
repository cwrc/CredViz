ko.components.register('credit-visualization', {
   template: ' <div class="error" data-bind="visible: errorText">\
                  <header>Error</header>\
                  <p><span data-bind="text: errorText"></span></p>\
               </div>\
               <div data-bind="visible: !errorText()">\
                  <div class="view-tabs" data-bind="foreach: views">\
                     <a href="#" data-bind="click: function() { $parent.view($data) }, \
                                            css: {selected: $parent.isView($data)}, \
                                            text: $data"></a>\
                  </div>\
                  <div data-bind="visible: isView(\'Graph\'), attr: {id: htmlId()}">\
                     <svg data-bind="attr: {width: width, height: height}"></svg>\
                  </div>\
                  <div data-bind="visible: isView(\'Timeline\'), attr: {id: htmlId()}">\
                     <!-- timeline here -->\
                  </div>\
                  <div data-bind="visible: isView(\'Table\'), attr: {id: htmlId()}">\
                     <credit-visualization-table data-bind="style: {width: width + \'px\', height: height + \'px\'}" params="data: filteredModifications"></credit-visualization-table>\
                  </div>\
                  <header class="graph-title">\
                     <span>Contributions to</span>\
                     <a href="#" data-bind="attr: {href: titleTarget}, text: titleText"></a>,\
                     <span>by Type</span>\
                  </header>\
                  <div class="documents">\
                     <header>Documents</header>\
                     <div data-bind="foreach: documents">\
                        <label>\
                           <input type="checkbox" data-bind="value: $data.id,\
                                                             checked: $parent.filter.pid" />\
                           <span data-bind="text: $data.name">Document</span>\
                        </label>\
                     </div>\
                  </div>\
                  <div class="filters">\
                     <div class="users">\
                        <header>Users</header>\
                        <!-- ko foreach: users -->\
                        <label>\
                           <input type="checkbox" data-bind="value: $data.id,\
                                                             checked: $parent.filter.users" />\
                           <span data-bind="text: $data.name">User</span>\
                        </label>\
                        <!-- /ko -->\
                     </div>\
                  </div>\
                  <div class="actions">\
                     <div class="overlay" data-bind="visible: errorText"></div>\
                     <div class="embed popup" data-bind="visible: embedVisible">\
                        <p>Copy this HTML to your page:</p>\
                        <code data-bind="text: embedTarget"></code>\
                        <button data-bind="click: toggleEmbed">Close</button>\
                     </div>\
                     <div class="overlay" data-bind="visible: embedVisible, click: toggleEmbed"></div>\
                     <button data-bind="click: toggleEmbed">Link</button>\
                     <div class="download-popup popup" data-bind="visible: downloadVisible">\
                        <p>Save as...</p>\
                        <div class="options">\
                           <button data-bind="click: function() { saveScreenshot(\'png\') }">PNG</button>\
                           <button data-bind="click: function() { saveScreenshot(\'jpg\') }">JPG</button>\
                           <button data-bind="click: savePDF">PDF</button>\
                        </div>\
                        <button data-bind="click: toggleDownload">Close</button>\
                     </div>\
                     <div class="overlay" data-bind="visible: downloadVisible, click: toggleDownload"></div>\
                     <button data-bind="click: toggleDownload">Download</button>\
                  </div>\
               </div>',

   /**
    * Uses dom-to-node to produce images. https://github.com/tsayen/dom-to-image
    *
    * @param id - the HTML id to assign to the SVG wrapper div, which is then used internally to locate this instance's graph
    * @param
    */
   viewModel: function (params) {
      var self = this;

      self.htmlId = ko.observable(params.id || 'creditvis');
      self.width = params.width || 1024;
      self.height = params.height || 500;

      // STATE

      var uriParams = (new URI()).search(true);
      var pidList = uriParams['pid[]'] || [];
      var userList = params.user || uriParams['users[]'] || [];

      self.filter = {
         collectionId: ko.observable(uriParams.collectionId),
         users: ko.observableArray(userList instanceof Array ? userList : [userList]),
         pid: ko.observableArray(pidList instanceof Array ? pidList : [pidList])
      };

      self.errorText = ko.observable();

      self.embedTarget = ko.observable('');
      self.embedVisible = ko.observable(false);

      self.downloadVisible = ko.observable(false);

      self.toggleEmbed = function () {
         var uri = new URI();

         self.embedVisible(!self.embedVisible());

         self.embedTarget('<iframe src="' + uri + '"></iframe>');
      };

      self.toggleDownload = function () {
         self.downloadVisible(!self.downloadVisible());
      };

      //self.views = ['Graph', 'Timeline', 'Table'];
      self.views = ['Graph', 'Table'];
      self.view = ko.observable('Graph');

      self.isView = function (viewName) {
         return self.view() == viewName;
      };

      self.allModifications = ko.pureComputed(function () {
         var data, countChanges, documents;

         if (!self.totalModel())
            return [];

         documents = self.totalModel().documents;

         if (self.isProjectView()) {
            data = documents.reduce(function (aggregate, document) {
               return aggregate.concat(document.modifications);
            }, []);
         } else {
            data = documents.find(function (doc) {
               // TODO: this really would be nicer to include in filteredModifications instead
               return doc.id == self.filter.pid()
            }).modifications;
         }

         countChanges = CWRC.CreditVisualization.StackedColumnGraph.countChanges;

         data = self.sanitize(data).sort(function (a, b) {
            return countChanges(b) - countChanges(a)
         });

         return data;
      });

      self.filteredModifications = ko.pureComputed(function () {
         var filter, dataset, matchesUser, matchesDocument;

         filter = self.filter;

         matchesUser = function (datum) {
            return !filter.users() ||
               filter.users().length == 0 ||
               filter.users().indexOf(datum.user.id) >= 0
         };

         matchesDocument = function (datum) {
            // todo: this is curretnly actually accomplished in totalModifications because we don't have document
            // todo: data here
            return true;

            //return !filter.pid() ||
            //   filter.pid().length == 0 ||
            //filter.pid().indexOf(datum.document.id) >= 0
         };

         return (self.allModifications() || []).filter(function (datum) {
            return matchesUser(datum) && matchesDocument(datum);
         });
      });

      self.totalNumChanges = ko.pureComputed(function () {
         return self.allModifications().reduce(function (aggregate, datum) {
            return aggregate + CWRC.CreditVisualization.StackedColumnGraph.countChanges(datum);
         }, 0);
      });

      self.users = ko.pureComputed(function () {
         var users;

         users = self.allModifications().map(function (datum) {
            return datum.user;
         }).reduce(function (aggregate, user) {
            if (!aggregate.find(function (u) {
                  return u.name == user.name;
               })) {
               aggregate.push(user);
            }

            return aggregate;
         }, []);

         return users;
      });
      self.totalModel = ko.observable();

      self.documents = ko.pureComputed(function () {
         return self.totalModel() ? self.totalModel().documents : [];
      });

      self.selectedDocuments = ko.pureComputed(function () {
         return self.documents().filter(function (doc) {
            return self.filter.pid().indexOf(doc.id) >= 0;
         });
      });

      self.isProjectView = ko.pureComputed(function () {
         return !self.filter.pid() || self.filter.pid().length != 1;
      });

      self.titleText = ko.pureComputed(function () {
         var title = '';

         if (self.totalModel()) {
            if (self.isProjectView())
               title += self.totalModel().name;
            else {
               var docs = self.selectedDocuments();

               title += docs[0] ? docs[0].name : '';
            }
         }

         return title;
      });
      self.titleTarget = ko.pureComputed(function () {
         var target = '/';

         if (self.totalModel()) {
            target += 'islandora/object/';

            if (self.isProjectView())
               target += self.totalModel().id;
            else {
               var docs = self.selectedDocuments();

               target += docs[0] ? docs[0].id : '';
            }
         }

         return target;
      });

      params.mergeTags = params.mergeTags || {};

      var currentURI = new URI();

      history.replaceState({filter: ko.mapping.toJS(self.filter)}, 'Credit Visualization', currentURI);

      self.buildURI = function () {
         var uri = new URI();

         for (var filterName in self.filter) {
            var value = self.filter[filterName]();

            if (value instanceof Array) {
               uri.setSearch(filterName + '[]', value);
            } else if (value) {
               uri.setSearch(filterName, filterName == 'user' ? value.id : value);
            } else {
               uri.removeSearch(filterName);
               uri.removeSearch(filterName + '[]');
            }
         }

         return uri;
      };

      self.sanitize = function (data) {
         var self = this, changeset, removable, mergedTagMap, cleanData;

         cleanData = [];
         mergedTagMap = params.mergeTags;

         // the endpoint returns each workflow change as a separate entry, so we're mering it here.
         data.forEach(function (modification, i) {
            var existingRecord = cleanData.find(function (other) {
               return other.user.id == modification.user.id;
            });

            if (!existingRecord) {
               existingRecord = {
                  user: modification.user,
                  workflow_changes: new CWRC.CreditVisualization.WorkflowChangeTally()
               };
               cleanData.push(existingRecord)
            }

            var key, scalarContributions;

            key = modification.workflow_changes.category;

            // these categories also have relevant file size diff data
            scalarContributions = ['created', 'deposited', 'content_contribution'];

            if (scalarContributions.indexOf(key) >= 0)
               existingRecord.workflow_changes[key] += parseInt(modification.diff_changes);
            else
               existingRecord.workflow_changes[key] += 1;
         });

         // also merge together categories that have aliases
         cleanData.forEach(function (modification) {
            changeset = modification.workflow_changes;

            for (var mergedTag in mergedTagMap) {
               var primaryTag = mergedTagMap[mergedTag];

               changeset[primaryTag] = (changeset[primaryTag] || 0) + (changeset[mergedTag] || 0);
               changeset[mergedTag] = 0;
            }
         });

         return cleanData;
      };

      // BEHAVIOUR

      // filter for hiding HTML nodes in screenshots
      var uiFilter = function (node) {
         var nodeClasses, hiddenClasses;

         // everything that's not an element probably should stay, since probably just content
         // also, you can't get attributes on non-elements
         if (node.nodeType != Node.ELEMENT_NODE)
            return true;

         nodeClasses = (node.getAttribute('class') || '').split(/\s/);
         hiddenClasses = ['overlay', 'popup', 'actions'];

         return nodeClasses.every(function (nodeClass) {
            return hiddenClasses.indexOf(nodeClass) < 0;
         });
      };

      self.saveScreenshot = function (type) {
         var domNode, display, downloadImage;

         domNode = document.querySelector('credit-visualization');

         display = domNode.style.display;
         domNode.style.display = 'inline-block';

         downloadImage = function (dataUrl) {
            var link = document.createElement('a');

            link.download = self.titleText() + ((type == 'png') ? '.png' : '.jpeg');
            link.href = dataUrl;

            domNode.style.display = display;

            link.click();
         };

         if (type == 'png')
            domtoimage
               .toPng(domNode, {
                  bgcolor: '#fff',
                  filter: uiFilter
               })
               .then(downloadImage);
         else
            domtoimage
               .toJpeg(domNode, {
                  quality: 1.0,
                  bgcolor: '#fff',
                  filter: uiFilter
               })
               .then(downloadImage);
      };

      self.savePDF = function () {
         var domNode, display, pdf;

         domNode = document.querySelector('credit-visualization');

         display = domNode.style.display;
         domNode.style.display = 'inline-block';

         domtoimage
            .toPng(domNode, {
               bgcolor: '#fff',
               filter: uiFilter
            })
            .then(function (dataUrl) {
               var pdf, pdfWidth, pdfHeight, image, margin, x, y, aspectRatio, pdfImageWidth, pdfImageHeight;

               pdf = new jsPDF('portrait', 'mm'); // orientation, sizeUnit

               image = new Image();

               image.src = dataUrl;

               aspectRatio = image.width / image.height;

               x = 0;
               y = 0;

               pdfWidth = pdf.internal.pageSize.width;
               pdfHeight = pdf.internal.pageSize.height;

               margin = 0.10 * pdfWidth; //mm

               pdfImageWidth = 0.80 * pdfWidth;
               pdfImageHeight = pdfImageWidth / aspectRatio;


               pdf.addImage(dataUrl, 'JPEG', margin + x, margin + y, pdfImageWidth, pdfImageHeight);

               //console.log('image', image.width, image.height)
               //console.log(aspectRatio);
               //console.log('pdfImage', pdfImageWidth, 'x', pdfImageHeight)
               //console.log('pdf', pdfWidth, 'x', pdfHeight)
               //console.log(pdf)

               pdf.save(self.titleText() + '.pdf');
            });
      };

      self.getWorkData = function (id) {
         if (!self.filter.collectionId() && self.filter.pid().length == 0) {
            self.errorText('Must provide a project id');
            return;
         }

         ajax('get', '/services/credit_viz' + currentURI.search(), false, function (credViz) {
            /**
             * TODO: When/if the credit_viz service is capable of returning a result with both the project name
             * TODO: and the project's id, these next two ajax calls will become redundant, and can be collapsed
             */
            ajax('get', '/islandora/rest/v1/object/' + credViz.documents[0].id + '/relationship', null, function (relationships) {
               var parentRelationship, parentId;

               parentRelationship = relationships.find(function (relationship) {
                  return relationship.predicate.value == 'isMemberOfCollection'
               });

               // object.value is the value of the isMemberOfCollection relationship
               parentId = parentRelationship.object.value;

               ajax('get', '/islandora/rest/v1/object/' + parentId, null, function (objectDetails) {
                  var filterUpdateListener;

                  self.totalModel(credViz);

                  // TODO: remove - later versions of the credviz api should already contain the id
                  self.totalModel().id = parentId;

                  self.grapher = new CWRC.CreditVisualization.StackedColumnGraph(self.htmlId(), params.mergeTags, params.ignoreTags);

                  var historyUpdating = false;

                  filterUpdateListener = function (newVal) {
                     if (historyUpdating)
                        return;

                     self.grapher.updateBars(self.filteredModifications(), self.totalNumChanges());

                     history.pushState({filter: ko.mapping.toJS(self.filter)}, 'Credit Visualization', self.buildURI());
                  };

                  for (var key in self.filter) {
                     self.filter[key].subscribe(filterUpdateListener);
                  }

                  window.addEventListener('popstate', function (event) {
                     var historicalFilter = history.state.filter;
                     historyUpdating = true;

                     for (var key in self.filter) {
                        self.filter[key](historicalFilter[key])
                     }

                     historyUpdating = false;
                  });

// TODO: this is a hack to force it to draw the initial. It shouldn't be necessary. Something is wrong in the D3 section
                  // trigger a redraw to use now-loaded data
                  var users = self.filter.users();
                  self.filter.users([]);
                  self.filter.users(users);
               });
            });
         });
      };

      // d3 loads after KO, so push the AJAX fetch to the event stack.
      window.setTimeout(function () {
         self.getWorkData();
      });
   }
});

var CWRC = CWRC || {};
CWRC.CreditVisualization = CWRC.CreditVisualization || {};

CWRC.toTitleCase = function (string) {
   return string.split(/\s/g).map(function (word) {
      return word[0].toUpperCase() + word.slice(1);
   }).join(' ')
};

(function WorkflowChangeTally() {
   CWRC.CreditVisualization.WorkflowChangeTally = function () {
      this.created = 0;
      this.deposited = 0;
      this.metadata_contribution = 0;
      this.content_contribution = 0;
      this.checked = 0;
      this.machine_processed = 0;
      this.user_tagged = 0;
      this.rights_assigned = 0;
      this.published = 0;
      this.peer_reviewed = 0;
      this.evaluated = 0;
      this.peer_evaluated = 0;
      this.withdrawn = 0;
      this.deleted = 0;
   };

   CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES_TO_STAMPS = {
      created: 'cre',
      deposited: 'dep',
      metadata_contribution: 'evr',
      content_contribution: ['evr', 'cvr'],
      checked: 'ckd',
      machine_processed: ['evr', 'cvr'],
      user_tagged: 'tag',
      rights_assigned: 'rights_asg',
      published: 'pub',
      peer_evaluated: 'rev',
      evaluated: 'rev',
      peer_reviewed: 'rev',
      withdrawn: 'wdr',
      deleted: 'del'
   };

   CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES =
      Object.keys(CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES_TO_STAMPS);
})();