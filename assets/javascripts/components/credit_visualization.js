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
                  <div data-bind="visible: isView(\'Bar Graph\'), attr: {id: htmlId()}">\
                     <svg data-bind="attr: {width: width, height: height}"></svg>\
                  </div>\
                  <div data-bind="visible: isView(\'Timeline\')">\
                     <!-- timeline here -->\
                  </div>\
                  <div data-bind="visible: isView(\'Table\')">\
                     <credit-visualization-table data-bind="style: {width: width + \'px\', height: height + \'px\'}" \
                                                 params="filteredModifications: filteredModifications, \
                                                         totalNumChanges: totalNumChanges, \
                                                         ignoreTags: ignoreTags,\
                                                         mergeTags: mergeTags"></credit-visualization-table>\
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
                  <footer data-bind="text: creationTime">\
                  </footer>\
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
      var uriParams, pidList, userList, historyUpdating;

      uriParams = (new URI()).search(true);
      pidList = uriParams['pid[]'] || [];
      userList = params.user || uriParams['users[]'] || [];

      historyUpdating = false;

      self.filter = {
         collectionId: ko.observable(uriParams.collectionId),
         users: ko.observableArray(userList instanceof Array ? userList : [userList]),
         pid: ko.observableArray(pidList instanceof Array ? pidList : [pidList])
      };

      self.errorText = ko.observable();

      self.embedTarget = ko.observable('');
      self.embedVisible = ko.observable(false);

      self.downloadVisible = ko.observable(false);
      self.isPrinting = ko.observable(false);
      self.creationTime = ko.observable('');

      self.toggleEmbed = function () {
         var uri = new URI();

         self.embedVisible(!self.embedVisible());

         self.embedTarget('<iframe src="' + uri + '"></iframe>');
      };

      self.toggleDownload = function () {
         self.downloadVisible(!self.downloadVisible());
      };

      //self.views = ['Bar Graph', 'Timeline', 'Table'];
      self.views = ['Bar Graph', 'Table'];
      self.view = ko.observable(uriParams.view || 'Bar Graph');

      self.view.subscribe(function (newView) {
         if (historyUpdating)
            return;

         self.history.save()
      });

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
            // todo: this is curretnly actually accomplished in totalModifications because we don't
            // todo: have document data available here
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
      self.filename = ko.pureComputed(function () {
         var generationTime, timeString;

         generationTime = new Date();

         timeString = generationTime.toISOString().replace(':', '-');
         timeString = timeString.split('T')[0];

         return (self.titleText().toLowerCase() + ' contributions ' + timeString).replace(/\s/g, '_');
      });

      self.mergeTags = params.mergeTags || {};
      self.ignoreTags = params.ignoreTags || [];

      self.sanitize = function (data) {
         var self = this, changeset, removable, mergedTagMap, cleanData;

         cleanData = [];
         mergedTagMap = self.mergeTags;

         // the endpoint returns each workflow change as a separate entry, so we're merging it here.
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

            var category, scalarContributions;

            category = modification.workflow_changes.category;

            // these categories also have relevant file size diff data
            scalarContributions = ['created', 'deposited', 'content_contribution'];

            if (scalarContributions.indexOf(category) >= 0)
               existingRecord.workflow_changes[category].addValue(parseInt(modification.diff_changes));
            else
               existingRecord.workflow_changes[category].addValue(1);
         });

         // also merge together categories that have aliases
         cleanData.forEach(function (modification) {
            changeset = modification.workflow_changes;

            for (var mergedTag in mergedTagMap) {
               var primaryTag = mergedTagMap[mergedTag];

               changeset[primaryTag].addValue(changeset[mergedTag].rawValue() || 0);
               delete changeset[mergedTag];
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

         self.creationTime('Generated on ' + new Date());

         downloadImage = function (dataUrl) {
            var link = document.createElement('a');

            link.download = self.filename() + ((type == 'png') ? '.png' : '.jpeg');
            link.href = dataUrl;

            domNode.style.display = display;

            link.click();

            self.creationTime('');
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
         var domNode, pdf, linkTarget, textWidth, textHeight, scaledLineHeight, linkPadding;

         domNode = document.querySelector('credit-visualization');

         domNode.style.display = 'inline-block';

         self.creationTime('Generated on ' + new Date());

         domtoimage
            .toPng(domNode, {
               bgcolor: '#fff',
               filter: uiFilter
            })
            .then(function (dataUrl) {
               var pdf, pdfWidth, pdfHeight, image, margin, imageX, imageY, aspectRatio, pdfImageWidth,
                  pdfImageHeight, linkX, linkY, timeString;

               pdf = new jsPDF('portrait', 'mm'); // orientation, sizeUnit

               image = new Image();

               image.src = dataUrl;

               image.onload = function () {
                  aspectRatio = image.naturalWidth / image.naturalHeight;

                  pdfWidth = pdf.internal.pageSize.width;
                  pdfHeight = pdf.internal.pageSize.height;

                  margin = 0.10 * pdfWidth; //mm

                  imageX = 0 + margin;
                  imageY = 0 + margin;

                  pdfImageWidth = 0.80 * pdfWidth;
                  pdfImageHeight = pdfImageWidth / aspectRatio;

                  pdf.addImage(dataUrl, 'PNG', imageX, imageY, pdfImageWidth, pdfImageHeight);

                  pdf.setFontSize(9);
                  pdf.setTextColor(0, 0, 238);

                  scaledLineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor;

                  linkTarget = (new URI()).toString();

                  linkX = pdfWidth / 2 - pdf.getTextWidth(linkTarget) / 2;
                  linkY = imageY + pdfImageHeight + scaledLineHeight;

                  linkTarget = pdf.splitTextToSize(linkTarget, pdfWidth - margin * 2);

                  /*
                   * Docs don't seem to be done for link annotations.
                   * See: https://github.com/MrRio/jsPDF/issues/170#issuecomment-293975156
                   */

                  // todo: use textWithLink instead when it accepts multilines
                  // pdf.textWithLink(linkTarget, linkX, linkY, {url: linkTarget});
                  linkPadding = 1;

                  textWidth = (linkPadding * 2) +
                     linkTarget.reduce(function (currentMax, line) {
                        return Math.max(currentMax, pdf.getTextWidth(line));
                     }, 0);

                  textHeight = linkTarget.length * scaledLineHeight + linkPadding * 2;

                  pdf.text(linkTarget, linkX, linkY);
                  pdf.link(linkX, linkY - scaledLineHeight, textWidth, textHeight, {url: linkTarget});
                  //pdf.rect(linkX, linkY - scaledLineHeight, textWidth, textHeight); // useful for debug

                  pdf.save(self.filename() + '.pdf');

                  self.creationTime('');
               }
            });
      };

      self.getWorkData = function (id) {
         var currentSearch, forwardingURI;

         currentSearch = (new URI()).search(true);
         forwardingURI = new URI();
         forwardingURI.search(''); // sets to empty

         if (currentSearch['pid'])
            forwardingURI.setSearch('pid', currentSearch.pid);

         if (currentSearch['collectionId'])
            forwardingURI.setSearch('collectionId', currentSearch.collectionId);

         if (currentSearch['userId'])
            forwardingURI.setSearch('userId', currentSearch.userId);

         if (!self.filter.collectionId() && self.filter.pid().length == 0) {
            self.errorText('Must provide a project id');
            return;
         }

         ajax('get', '/services/credit_viz' + forwardingURI.search(), false, function (credViz) {
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

                  self.grapher = new CWRC.CreditVisualization.StackedColumnGraph(self.htmlId(), self.mergeTags, self.ignoreTags);

                  filterUpdateListener = function (newVal) {
                     self.grapher.updateBars(self.filteredModifications(), self.totalNumChanges());

                     if (!historyUpdating) {
                        self.history.save();
                     }
                  };

                  for (var key in self.filter) {
                     self.filter[key].subscribe(filterUpdateListener);
                  }

                  window.addEventListener('popstate', self.history.load);

// TODO: this is a hack to force it to draw the initial. It shouldn't be necessary. Something is wrong in the D3 section
                  // trigger a redraw to use now-loaded data
                  historyUpdating = true;
                  var users = self.filter.users();
                  self.filter.users([]);
                  self.filter.users(users);
                  historyUpdating = false;
               });
            });
         });
      };

      self.history = {
         save: function (merge) {
            var data, uri;

            data = {
               filter: ko.mapping.toJS(self.filter),
               view: self.view()
            };

            uri = new URI();

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

            uri.setSearch('view', self.view());

            if (merge)
               history.replaceState(data, 'Credit Visualization', uri);
            else
               history.pushState(data, 'Credit Visualization', uri);
         },
         load: function (event) {
            var historicalState = history.state;
            historyUpdating = true;

            for (var key in self.filter) {
               self.filter[key](historicalState.filter[key]);
            }

            self.view(historicalState.view);

            historyUpdating = false;
         }
      };

      self.history.save(true)

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
      var self = this;

      CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES
         .forEach(function (key) {
            self[key] = new CWRC.CreditVisualization.WorkflowChange()
         });
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

(function WorkflowChange() {
   CWRC.CreditVisualization.WorkflowChange = function () {
      var self = this;

      self.rawValue = ko.observable(0);
      self.weight = ko.observable(1);

      self.weightedValue = ko.pureComputed(function () {
         return self.rawValue() * self.weight();
      });
   };

   CWRC.CreditVisualization.WorkflowChange.prototype.addValue = function (newVal) {
      this.rawValue(this.rawValue() + newVal)
   };
})();
