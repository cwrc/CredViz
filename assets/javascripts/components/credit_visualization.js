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
                  <div class="tab" data-bind="visible: isView(\'Bar Graph\'), attr: {id: htmlId()}">\
                     <svg data-bind="attr: {width: width, height: height}"></svg>\
                  </div>\
                  <div class="tab" data-bind="visible: isView(\'Timeline\')">\
                     <credit-visualization-timeline params="data: filteredChanges, \
                                                            labels: labels"></credit-visualization-timeline>\
                  </div>\
                  <div class="tab" data-bind="visible: isView(\'Table\')">\
                     <credit-visualization-table data-bind="style: {width: width + \'px\', height: height + \'px\'}" \
                                                 params="data: filteredChanges, \
                                                         totalNumChanges: totalNumChanges, \
                                                         labels: labels"></credit-visualization-table>\
                  </div>\
                  <header class="graph-title">\
                     <!-- ko if: !isPrinting() -->\
                        <span>Contributions to</span>\
                        <a href="#" data-bind="attr: {href: titleTarget}, text: titleSubject"></a>,\
                        <span>by Type</span>\
                     <!-- /ko -->\
                     <span data-bind="visible: isPrinting, text: exportTitle"></span>\
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
                     <date_filter params="minTime: minTime, \
                                          maxTime: maxTime, \
                                          rangeMinObservable: filter.timeStart, \
                                          rangeMaxObservable: filter.timeEnd"></date_filter>\
                  </div>\
                  <div class="actions">\
                     <button data-bind="click: toggleEmbed">Link</button>\
                     <button data-bind="click: toggleDownload">Download</button>\
                     <button data-bind="click: toggleLabelEditor">Edit Labels</button>\
                     <div class="embed popup" data-bind="visible: embedVisible">\
                        <p>Copy this HTML to your page:</p>\
                        <code data-bind="text: embedTarget"></code>\
                        <button data-bind="click: toggleEmbed">Close</button>\
                     </div>\
                     <div class="download-popup popup" data-bind="visible: downloadVisible">\
                        <header>Download</header>\
                        <div class="labelling">\
                           <header>Annotations (optional)</header>\
                           <label>\
                              <span>Title</span>\
                              <input type="text" data-bind="value: exportTitle" />\
                           </label>\
                           <label class="notes">\
                              <span>Notes</span>\
                              <textarea data-bind="value: notes"></textarea>\
                           </label>\
                        </div>\
                        <p>Save as...</p>\
                        <div class="options">\
                           <button data-bind="click: function() { saveScreenshot(\'png\') }">PNG</button>\
                           <button data-bind="click: function() { saveScreenshot(\'jpg\') }">JPG</button>\
                           <button data-bind="click: savePDF">PDF</button>\
                        </div>\
                        <button data-bind="click: toggleDownload">Close</button>\
                     </div>\
                     <div class="popup" data-bind="visible: labelEditorVisible">\
                        <credit-visualization-label-editor params="labels: labels"></credit-visualization-label-editor>\
                        <button data-bind="click: toggleLabelEditor">Done</button>\
                     </div>\
                     <div class="overlay" data-bind="visible: overlayVisible, click: clickOverlay"></div>\
                  </div>\
                  <footer data-bind="visible: isPrinting">\
                     <div class="notes" data-bind="text: notes"></div>\
                     <div class="time" data-bind="text: creationTime"></div>\
                  </footer>\
               </div>',

   /**
    * A credit visualization widget designed to plug into CWRC.
    *
    * If you are unfamiliar with Islandora, take a quick read though the primer:
    * https://wiki.duraspace.org/display/ISLANDORA/Getting+Started+with+Islandora
    *
    * Uses dom-to-node to produce images. https://github.com/tsayen/dom-to-image
    *
    * @params params
    *         - id: the HTML id to assign to the SVG wrapper div, which is then used internally to locate this instance's graph
    *         - width: the pixel width of the whole widget
    *         - height: the pixel height of the whole widget
    *         - user: the particular user to request data for
    *         - mergeTags: Hash where keys are a tag that maps to the primary tag which the key should be merged into
    *         - ignoreTags: List of tags to ignore. Each list element is a string.
    *         - tagWeights: Hash that maps tag names to the relative weight for that tag in calulations.
    *
    */
   viewModel: function (params) {
      var self = this;

      self.htmlId = ko.observable(params.id || 'creditvis');
      self.width = params.width || 1024;
      self.height = params.height || 500;
      self.tagWeights = params.tagWeights;
      self.mergeTags = params.mergeTags || {};
      self.ignoreTags = params.ignoreTags || [];
      self.labels = CWRC.CreditVisualization.WorkflowChangeSet.CATEGORIES.reduce(function (object, category) {
         var removedTags = Object.keys(self.mergeTags).concat(self.ignoreTags);

         if (removedTags.indexOf(category) < 0)
            object[category] = ko.observable(CWRC.toTitleCase(category.replace('_', ' ')));

         return object;
      }, {});
      self.notes = ko.observable();
      self.exportTitle = ko.observable();

      // STATE
      var uriParams, pidList, userList, timeStart, timeEnd, historyUpdating;

      uriParams = (new URI()).search(true);
      pidList = uriParams['pid[]'] || [];
      userList = params.user || uriParams['users[]'] || [];
      timeStart = new Date(parseInt(params.timeStart || uriParams['timeStart'] || 0));
      timeEnd = new Date(params.timeEnd || parseInt(uriParams['timeEnd']) || new Date());

      historyUpdating = false;

      self.filter = {
         collectionId: ko.observable(uriParams.collectionId),
         users: ko.observableArray(userList instanceof Array ? userList : [userList]),
         pid: ko.observableArray(pidList instanceof Array ? pidList : [pidList]),
         timeStart: ko.observable(timeStart.getTime()),
         timeEnd: ko.observable(timeEnd.getTime())
      };

      self.errorText = ko.observable();

      self.embedTarget = ko.observable('');
      self.embedVisible = ko.observable(false);

      self.downloadVisible = ko.observable(false);
      self.isPrinting = ko.observable(false);
      self.creationTime = ko.observable('');

      self.labelEditorVisible = ko.observable(false);

      self.toggleEmbed = function () {
         var uri = new URI();

         self.embedVisible(!self.embedVisible());

         self.embedTarget('<iframe src="' + uri + '"></iframe>');
      };

      self.toggleDownload = function () {
         self.downloadVisible(!self.downloadVisible());
      };

      self.toggleLabelEditor = function () {
         self.labelEditorVisible(!self.labelEditorVisible());
      };

      self.overlayVisible = ko.pureComputed(function () {
         return self.downloadVisible() || self.embedVisible() || self.errorText() || self.labelEditorVisible();
      });

      self.clickOverlay = function () {
         self.downloadVisible(false);
         self.embedVisible(false);
         self.labelEditorVisible(false);
      };

      self.views = ['Bar Graph', 'Table', 'Timeline'];
      self.view = ko.observable(uriParams.view || 'Bar Graph');

      self.view.subscribe(function (newView) {
         if (historyUpdating)
            return;

         self.history.save()
      });

      self.isView = function (viewName) {
         return self.view() == viewName;
      };

      self.allChangeSets = ko.pureComputed(function () {
         var data;

         if (!self.fullSource())
            return [];

         data = self.normalize(self.fullSource().documents);

         data = data.sort(function (a, b) {
            return b.totalValue() - a.totalValue()
         });

         return data;
      });

      self.filteredChanges = ko.pureComputed(function () {
         var filter, matchesUser, matchesDocument, matchesTime, result;

         filter = self.filter;

         matchesUser = function (change) {
            return !filter.users() ||
               filter.users().length == 0 ||
               filter.users().indexOf(change.user.id) >= 0
         };

         matchesDocument = function (change) {
            return !filter.pid() ||
               filter.pid().length == 0 ||
               filter.pid().indexOf(change.document.id) >= 0
         };

         matchesTime = function (change) {
            return change.inTimeRange(filter.timeStart(), filter.timeEnd())
         };

         var allChanges = self.allChangeSets().reduce(function (agg, changeSet) {
            return agg.concat(changeSet.workChanges())
         }, []);

         result = allChanges.filter(function (change) {
            return matchesUser(change) && matchesDocument(change) && matchesTime(change);
         });

         return result;
      });

      self.totalNumChanges = ko.pureComputed(function () {
         return self.allChangeSets().reduce(function (aggregate, changeSet) {
            if (self.isProjectView() || self.filter.pid().indexOf(changeSet.document.id) >= 0)
               return aggregate + changeSet.totalValue();
            else
               return aggregate;
         }, 0);
      });

      self.users = ko.pureComputed(function () {
         var users;

         users = self.allChangeSets()
            .reduce(function (agg, changeSet) {
               return agg.concat(changeSet.workChanges());
            }, [])
            .map(function (change) {
               return change.user;
            })
            .filter(function (user, index, arr) {
               return arr.findIndex(function (u) {
                     return u.id == user.id
                  }) === index;
            });

         return users;
      });
      self.minTime = ko.pureComputed(function () {
         var earliestDate, userMods;

         userMods = self.allChangeSets();

         if (userMods.length == 0)
            return new Date(0).getTime();

         earliestDate = userMods.reduce(function (lowest, mod) {
            mod.allValues().forEach(function (change) {
               var stamp = new Date(change.timestamp).getTime();

               if (stamp < lowest)
                  lowest = stamp;
            });

            return lowest;
         }, Infinity);

         return earliestDate;
      });
      self.maxTime = ko.pureComputed(function () {
         var latestDate, userMods;

         userMods = self.allChangeSets();

         if (userMods.length == 0)
            return new Date().getTime();

         latestDate = userMods.reduce(function (highest, mod) {
            mod.allValues().forEach(function (change) {
               var stamp = new Date(change.timestamp).getTime();

               if (stamp > highest)
                  highest = stamp;
            });

            return highest;
         }, -Infinity);

         return latestDate;
      });

      self.fullSource = ko.observable();

      self.documents = ko.pureComputed(function () {
         return self.fullSource() ? self.fullSource().documents : [];
      });

      self.selectedDocuments = ko.pureComputed(function () {
         return self.documents().filter(function (doc) {
            return self.filter.pid().indexOf(doc.id) >= 0;
         });
      });

      self.isProjectView = ko.pureComputed(function () {
         return self.filter.pid().length == 0 || self.filter.pid().length == self.documents().length;
      });

      self.titleSubject = ko.pureComputed(function () {
         var title = '';

         if (self.fullSource()) {
            if (self.isProjectView())
               title += self.fullSource().name;
            else {
               var docs = self.selectedDocuments();

               title += docs[0] ? docs[0].name : '';
            }
         }

         return title;
      });
      self.titleTarget = ko.pureComputed(function () {
         var target = '/';

         if (self.fullSource()) {
            target += 'islandora/object/';

            if (self.isProjectView())
               target += self.fullSource().id;
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

         return (self.titleSubject().toLowerCase() + ' contributions ' + timeString).replace(/\s/g, '_');
      });

      self.normalize = function (documents) {
         var self = this, cleanData, sourceValue, data;

         cleanData = [];

         documents.forEach(function (document) {
            data = Array.prototype.concat.apply([], document.modifications);

            // the endpoint returns each workflow change as a separate entry, so we're merging it here.
            data.forEach(function (modification) {
               var category, existingRecord, user;

               user = modification.user;

               existingRecord = cleanData.find(function (other) {
                  return other.document.id == document.id;
               });

               if (!existingRecord) {
                  existingRecord = new CWRC.CreditVisualization.WorkflowChangeSet(
                     document,
                     self.mergeTags,
                     self.tagWeights);
                  cleanData.push(existingRecord)
               }

               category = modification.workflow_changes.category;

               if (CWRC.CreditVisualization.WorkflowChangeSet.isScalar(category))
                  sourceValue = parseInt(modification.diff_changes);
               else
                  sourceValue = 1;

               existingRecord.addChange(user, category, sourceValue, modification.workflow_changes.timestamp);
            });
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
         self.exportTitle(self.exportTitle() || 'Contributions to ' + self.titleSubject() + ', by Type');
         self.isPrinting(true);

         downloadImage = function (dataUrl) {
            var link = document.createElement('a');

            link.download = self.filename() + ((type == 'png') ? '.png' : '.jpeg');
            link.href = dataUrl;

            domNode.style.display = display;

            link.click();

            self.isPrinting(false);
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
         self.exportTitle(self.exportTitle() || 'Contributions to ' + self.titleSubject() + ', by Type');
         self.isPrinting(true);

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

                  linkX = pdfWidth / 2 - textWidth / 2;
                  linkY = imageY + pdfImageHeight + scaledLineHeight;

                  pdf.text(linkTarget, linkX, linkY);
                  pdf.link(linkX, linkY - scaledLineHeight, textWidth, textHeight, {url: linkTarget});
                  //pdf.rect(linkX, linkY - scaledLineHeight, textWidth, textHeight); // useful for debug

                  pdf.save(self.filename() + '.pdf');

                  self.isPrinting(false);
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
            //var WORKFLOW_DSID = 'WORKFLOW';

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

               //ajax('get', '/islandora/rest/v1/object/' + parentId + '/datastream/WORKFLOW', null, function (workflowData) {
               var filterUpdateListener;

               self.fullSource(credViz);

               // TODO: remove - later versions of the credviz api should already contain the id
               self.fullSource().id = parentId;

               self.grapher =
                  new CWRC.CreditVisualization.StackedColumnGraph(
                     self.htmlId(),
                     self.tagWeights,
                     self.labels);

               filterUpdateListener = function (newVal) {
                  self.grapher.updateBars(self.filteredChanges(), self.totalNumChanges());

                  if (!historyUpdating) {
                     self.history.save();
                  }
               };

               for (var key in self.filter) {
                  self.filter[key].subscribe(filterUpdateListener);
               }

               window.addEventListener('popstate', self.history.load);

               historyUpdating = true;
               filterUpdateListener();
               historyUpdating = false;
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

            if (!historicalState)
               return;

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

(function WorkflowChangeSet() {
   CWRC.CreditVisualization.WorkflowChangeSet = function (document, mergedTagMap, tagWeightMap) {
      var self = this;

      self.document = document;
      self.mergedTagMap = mergedTagMap || {};
      self.tagWeightMap = tagWeightMap || {};
      self.workChanges = ko.observableArray([]);
   };

   CWRC.CreditVisualization.WorkflowChangeSet.prototype.addChange = function (user, category, newVal, timestamp) {
      var self = this, weight, change;

      category = self.mergedTagMap[category] || category;

      weight = self.tagWeightMap[category];

      change = new CWRC.CreditVisualization.WorkflowChange(newVal, weight, timestamp, user, category, self.document);

      self.workChanges.push(change);
   };

   CWRC.CreditVisualization.WorkflowChangeSet.prototype.totalValue = function () {
      var self = this;

      return self.workChanges().reduce(function (aggregate, change) {
         return aggregate + change.weightedValue();
      }, 0);
   };

   CWRC.CreditVisualization.WorkflowChangeSet.prototype.allValues = function () {
      var self = this;

      return self.workChanges();
   };

   CWRC.CreditVisualization.WorkflowChangeSet.isScalar = function (category) {
      return CWRC.CreditVisualization.WorkflowChangeSet.SCALAR_CATEGORIES.indexOf(category) >= 0;
   };

   CWRC.CreditVisualization.WorkflowChangeSet.CATEGORIES_TO_STAMPS = {
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

   CWRC.CreditVisualization.WorkflowChangeSet.CATEGORIES =
      Object.keys(CWRC.CreditVisualization.WorkflowChangeSet.CATEGORIES_TO_STAMPS);

   // these are the categories whose values are based on actual filesize diffs
   CWRC.CreditVisualization.WorkflowChangeSet.SCALAR_CATEGORIES = ['created', 'deposited', 'content_contribution'];
})();

(function WorkflowChange() {
   CWRC.CreditVisualization.WorkflowChange = function (value, weight, timestamp, user, category, document) {
      var self = this;

      self.rawValue = ko.observable(value || 0);
      self.weight = ko.observable(weight == null ? 1 : weight);
      self.timestamp = timestamp;
      self.user = user;
      self.document = document;
      self.category = category;

      self.weightedValue = ko.pureComputed(function () {
         return self.rawValue() * self.weight();
      });
   };

   CWRC.CreditVisualization.WorkflowChange.prototype.inTimeRange = function (start, end) {
      var self = this, afterStart, beforeEnd, stamp;

      stamp = new Date(self.timestamp);

      afterStart = start != null ? new Date(start) <= stamp : true;

      beforeEnd = end != null ? stamp <= new Date(end) : true;

      return afterStart && beforeEnd;
   }
})();
