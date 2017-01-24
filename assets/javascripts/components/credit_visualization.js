ko.components.register('credit_visualization', {
   template: ' <div data-bind="attr: {id: htmlId()}">\
                  <svg width="1024" height="500" ></svg>\
               </div>\
               <header>\
                  <span>User Contributions to</span>\
                  <a href="#" data-bind="attr: {href: titleTarget}, text: titleText"></a>,\
                  <span>by Type</span>\
               </header>\
               <label>\
                  <span>User</span>\
                  <select data-bind="options: users, \
                                     optionsText: \'name\',\
                                     optionsCaption:\'(all)\',\
                                     value: filter.user"></select>\
               </label>\
               <label>\
                  <span>Document</span>\
                  <select data-bind="options: documents, \
                                     optionsText: \'name\',\
                                     optionsCaption:\'(all)\',\
                                     value: filter.pid"></select>\
               </label>',

   /**
    */
   viewModel: function (params) {
      var self = this;

      self.htmlId = ko.observable(params.id || 'creditvis');

      // STATE

      var uriParams = (new URI()).search(true);
      var pidList = uriParams['pid[]'] || [];

      self.filter = {
         user: ko.observable(uriParams.user || {}),
         pid: ko.observableArray(pidList instanceof Array ? pidList : [pidList]),
         collectionId: ko.observable(uriParams.collectionId)
      };

      self.allModifications = ko.pureComputed(function () {
         var data;

         if (!self.totalModel())
            return [];

         if (self.isProjectView()) {
            data = self.totalModel().documents.reduce(function (aggregate, document) {
               return aggregate.concat(document.modifications);
            }, []);
         } else {
            data = self.totalModel().documents[0].modifications;
         }

         return data;
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

      self.firstDocument = ko.pureComputed(function () {
         return self.documents()[0];
      });

      self.isProjectView = ko.pureComputed(function () {
         return !self.filter.pid() || self.filter.pid().length == 0
      });

      self.titleText = ko.pureComputed(function () {
         if (self.totalModel())
            return self.isProjectView() ? self.totalModel().name : self.firstDocument().name;
         else
            return '';
      });
      self.titleTarget = ko.pureComputed(function () {
         if (self.totalModel())
            return '/islandora/object/' + (self.isProjectView() ? self.totalModel().id : self.firstDocument().id);
         else
            return '/';
      });

      params.mergeTags = params.mergeTags || {};

      var currentURI = new URI();

      history.replaceState({filter: ko.mapping.toJS(self.filter)}, 'Credit Visualization', currentURI);

      self.buildURI = function () {
         var uri = new URI();

         for (var filterName in self.filter) {
            var value = self.filter[filterName]();

            if (value instanceof Array && value.length > 0)
               uri.setSearch(filterName + '[]', value);
            else if (value)
               uri.setSearch(filterName, filterName == 'user' ? value.id : value);
            else
               uri.removeSearch(filterName);
         }

         return uri;
      };

      // BEHAVIOUR
      self.getWorkData = function (id) {
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
                  self.totalModel(credViz);

                  // TODO: remove - this should be returned in later versions of the credviz api
                  self.totalModel().id = parentId;

                  self.grapher = new CWRC.CreditVisualization.StackedColumnGraph(self.htmlId(), self.allModifications(), params.mergeTags, params.ignoreTags);

                  var filterUpdateListener = function (newVal) {
                     self.grapher.filter(ko.mapping.toJS(self.filter));

                     self.grapher.updateBars();

                     history.pushState({filter: ko.mapping.toJS(self.filter)}, 'Credit Visualization', self.buildURI());
                  };

                  self.filter.user.subscribe(filterUpdateListener);
                  self.filter.pid.subscribe(filterUpdateListener);

                  self.filter.user(null); // trigger a redraw to use now-loaded data
               });
            });
         });
      };

      // d3 loads after KO, so push the fetch to the event stack.
      window.setTimeout(function () {
         self.getWorkData();
      });
   }
});

var CWRC = CWRC || {};
CWRC.CreditVisualization = CWRC.CreditVisualization || {};

(function StackedColumnGraph() {
   CWRC.CreditVisualization.StackedColumnGraph = function (containerId, data, mergedTagMap, ignoredTags) {
      var self = this;

      self.containerId = containerId;
      self.svg = d3.select('#' + self.containerId + ' svg');

      self.workTypes = CWRC.CreditVisualization.WorkflowChangeTally.CATEGORIES.slice(0);

      self.bounds = {
         padding: {top: 20, right: 20, bottom: 60, left: 60},
         getOuterWidth: function () {
            return +self.svg.attr("width");
         },
         getOuterHeight: function () {
            return +self.svg.attr("height");
         },
         getInnerWidth: function () {
            return +self.svg.attr("width") - self.bounds.padding.left - self.bounds.padding.right;
         },
         getInnerHeight: function () {
            return +self.svg.attr("height") - self.bounds.padding.top - self.bounds.padding.bottom;
         },
         legendWidth: 80
      };
      self.contentGroup = self.svg.append("g");

      self.contentGroup.attr("transform", "translate(" + self.bounds.padding.left + "," + self.bounds.padding.top + ")");

      self.usersScale = d3.scaleBand()
         .padding(0.1)
         .align(0.1);

      self.contributionScale = d3.scaleLinear()
         .rangeRound([self.bounds.getInnerHeight(), 0]);

      self.colorScale = d3.scaleOrdinal(d3.schemeCategory20c);
      //.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

      self.minimumPercent = 0.01; // minimum value to display; 1.00 == 100%

      // removing the types from the list will mean that the Ordinal Scale will ignore those values.
      (Object.keys(mergedTagMap).concat(ignoredTags)).forEach(function (tag) {
         self.workTypes.splice(self.workTypes.indexOf(tag), 1)
      });

      data = self.sanitize(data, mergedTagMap);

      data = data.sort(function (a, b) {
         return self.countChanges(b) - self.countChanges(a)
      });

      self.data = data;

      self.allChangesCount = d3.sum(self.data, function (d) {
         return self.countChanges(d);
      });

      self.filteredData = self.data;

      this.constructLeftAxis();
      this.constructBottomAxis();
      this.updateBars();
      this.constructLegend();
      this.constructNoticeOverlay();
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.filter = function (filter) {
      var self = this;

      var matchesUser, matchesDocument;

      matchesUser = function (datum) {
         return !filter.user || datum.user.id == filter.user.id
      };

      matchesDocument = function (datum) {
         return !filter.pid || filter.pid.length == 0 || filter.pid.indexOf(datum.document.id) >= 0
      };

      self.filteredData = (self.data || []).filter(function (datum) {
         return matchesUser(datum) && matchesDocument(datum);
      });
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.updateBars = function () {
      var self = this;

      var seriesVM, workTagStacker, workTagStack, formatPercent, maxValue, segmentHoverHandler,
         rectBlocksVM, labelsVM, totalLabelsVM, hasSize, columnWidth, columnWidthThreshold, drawableCanvasWidth;

      workTagStacker = d3.stack()
         .keys(self.workTypes)
         .value(function (datum, key) {
            return (datum.workflow_changes[key] || 0) / self.allChangesCount
         });

      workTagStack = workTagStacker(self.filteredData);

      maxValue = d3.max(workTagStack.reduce(function (a, b) {
         return a.concat(b.reduce(function (c, d) {
            return c.concat(d);
         }, []));
      }, []));

      hasSize = function (positionsRow) {
         return Math.abs(positionsRow[0] - positionsRow[1]) > self.minimumPercent;
      };

      drawableCanvasWidth = self.bounds.getInnerWidth() - self.bounds.legendWidth;
      columnWidthThreshold = 4;

      self.usersScale.rangeRound([0, self.filteredData.length >= columnWidthThreshold ? drawableCanvasWidth : drawableCanvasWidth / columnWidthThreshold]);
      self.usersScale.domain(self.filteredData.map(function (d) {
         return JSON.stringify(d.user);
      }));
      self.contributionScale.domain([0, maxValue]).nice();
      self.colorScale.domain(self.workTypes);

      columnWidth = self.usersScale.bandwidth();

      // create one group for each work type
      seriesVM = self.contentGroup
         .selectAll('g.series')
         .data(workTagStack);
      //.data(workTagStack, function (d) {
      //   // need this to compare by item, not by list index
      //   return d;
      //});

      seriesVM.enter()
         .append("g")
         .merge(seriesVM)
         .attr("class", function (datum) {
            return "series tag-" + datum.key;
         })
         .attr("fill", function (d) {
            return self.colorScale(d.key);
         });

      seriesVM.exit().remove();

      // === The actual graphic rects ===
      segmentHoverHandler = function (d, rowNumber, group) {
         var keyName, isMouseEnter;
         isMouseEnter = d3.event.type == 'mouseover';

         keyName = d3.select(this.parentNode).datum().key;

         // assigns the 'highlight' class to hovered elements & unassign it from unhovered ones
         d3.select(d3.event.target).classed("highlight", isMouseEnter);

         // do the same for the corresponding legend category
         self.svg.select('.legend-' + keyName)
            .classed('highlight', isMouseEnter);

         self.svg.selectAll('.tag-' + keyName + ' text')
            .filter(function (d, labelRowNumber, f) {
               return rowNumber == labelRowNumber;
            })
            .classed('highlight', isMouseEnter);
      };

      rectBlocksVM =
         seriesVM
            .selectAll("rect") // get the existing rectangles
            .data(function (d) {
               return d;
            });

      rectBlocksVM
         .enter()// for new data items...
         .insert("rect", ':first-child')// add a rect & add it at the front to ensure that labels draw on top
         .merge(rectBlocksVM) // and now update properties on both the new rects and existing ones
         .filter(hasSize)// removing the empties cleans up the graph DOM for other conditionals
         .attr("x", function (d) {
            return self.usersScale(JSON.stringify(d.data.user));
         })
         .attr("y", function (dataRow) {
            return self.contributionScale(dataRow[1]);
         })
         .attr("height", function (dataRow) {
            return self.contributionScale(dataRow[0]) - self.contributionScale(dataRow[1]);
         })
         .attr("width", columnWidth)
         .classed('filled', true)
         .on("mouseover", segmentHoverHandler)
         .on("mouseout", segmentHoverHandler);

      rectBlocksVM.exit().remove();

      // === Column segment labels ===

      formatPercent = d3.format(".1%");

      labelsVM = seriesVM
         .selectAll('text')
         .data(function (d) {
            return d;
         });

      labelsVM
         .enter()
         .append('text')
         .merge(labelsVM)
         .filter(hasSize)// removing the empties cleans up the graph DOM for other conditionals
         .text(function (d) {
            var value = d[1] - d[0];

            return value > 0 ? formatPercent(value) : '';
         })
         .classed('filled', true)
         .attr("x", function (d) {
            return self.usersScale(JSON.stringify(d.data.user)) + columnWidth / 2;
         })
         .attr("y", function (dataRow) {
            var baseline = self.contributionScale(dataRow[0]);
            var top = self.contributionScale(dataRow[1]);

            return baseline + (top - self.contributionScale(dataRow[0])) / 2;
         });

      labelsVM.exit().remove();

      // === Column totals ===
      var totalLabelGroups =
         self.contentGroup
            .selectAll('.total-label')
            .data(self.filteredData, function (d) {
               //   need this to compare by item, not by list index
               return d.user.id;
            });

      totalLabelGroups
         .enter()
         .insert('text', '#' + self.containerId + ' g.legend')
         .merge(totalLabelGroups)
         .attr("class", function (datum) {
            return "total-label total-label-user-" + datum.user.id;
         })
         .text(function (d) {
            return formatPercent((self.countChanges(d) || 0) / (self.allChangesCount || 1));
         })
         .attr('x', function (d) {
            return self.usersScale(JSON.stringify(d.user)) + columnWidth / 2;
         })
         .attr('y', function (datum, index) {
            var finalStackRow, userSegment, segmentTop;

            // each stack row is all segments within a category, so last one is top
            finalStackRow = workTagStack[workTagStack.length - 1];
            userSegment = finalStackRow[index]; // the value pair for this column
            segmentTop = userSegment[1];

            return self.contributionScale(segmentTop) - 4;
         });

      totalLabelGroups.exit().remove();

      self.updateAxes();
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.sanitize = function (data, mergedTagMap) {
      var self = this, changeset, removable;

      var cleanData = [];

      // merge all mods from the same user
      //removable = [];

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

         //for (var key in modification.workflow_changes) {
         //   firstRecord.workflow_changes[key] = (firstRecord.workflow_changes[key] || 0) + modification.workflow_changes[key];
         //}

         var key, scalarContributions;

         key = modification.workflow_changes.category;

         // these catgeories also have relevant file size diff data
         scalarContributions = ['created', 'deposited', 'content_contribution'];

         if (scalarContributions.indexOf(key) >= 0)
            existingRecord.workflow_changes[key] += parseInt(modification.diff_changes);
         else
            existingRecord.workflow_changes[key] += 1;

         //removable.push(modification);
      });

      //removable.forEach(function (modification) {
      //   cleanData.splice(cleanData.indexOf(modification), 1)
      //});

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

   CWRC.CreditVisualization.StackedColumnGraph.prototype.updateAxes = function () {
      var self = this;

      self.updateLeftAxis();
      self.updateBottomAxis();
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLeftAxis = function () {
      var self = this, verticalAxis, tickLine;

      self.verticalAxis = d3.axisLeft(self.contributionScale)
         .ticks(10, "s")
         .tickFormat(d3.format(".1%"));

      tickLine = self.contentGroup
         .append("g")
         .attr("class", "axis axis--y")
         .call(self.verticalAxis);

      tickLine
         .append("text")
         .attr("x", 0)
         .attr("y", self.contributionScale(self.contributionScale.ticks(10).pop()) - 10)
         .attr("text-anchor", "right")
         .attr("fill", "#000")
         .text("Contribution");
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.updateLeftAxis = function () {
      this.svg
         .select('.axis--y').call(this.verticalAxis);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructBottomAxis = function () {
      var self = this;

      self.horizontalAxis = d3.axisBottom(self.usersScale)
         .tickFormat(function (datum) {
            return JSON.parse(datum).name;
         });

      self.contentGroup.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", "translate(0," + self.bounds.getInnerHeight() + ")")
         .call(self.horizontalAxis);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.updateBottomAxis = function () {
      var self = this;

      var tickGroup, existingTickLabels, userLabelHoverHandler, columnWidth, tickFill, tickX, tickY, tickDY;

      tickGroup = self.svg.select('.axis--x');

      tickGroup.call(this.horizontalAxis);

      /*
       * replacing each label text with an anchor because we can't change
       * the tick construction process to use anchors instead
       */
      existingTickLabels = tickGroup.selectAll('.tick text');
      if (!existingTickLabels.empty()) {
         tickFill = existingTickLabels.attr('fill');
         tickX = existingTickLabels.attr('x');
         tickY = existingTickLabels.attr('y');
         tickDY = existingTickLabels.attr('dy');
         existingTickLabels.remove();
      }

      userLabelHoverHandler = function () {
         var user, isEnter;

         user = JSON.parse(d3.select(this.parentNode).datum());

         isEnter = d3.event.type == 'mouseover';

         self.svg.select('.total-label-user-' + user.id)
            .classed('highlight', isEnter);
      };

      tickGroup.selectAll('.tick')
         .append('a')
         .attr('xlink:href', function (datum) {
            var user, uri;

            user = JSON.parse(datum);

            // ideally, it would actually include their true URI (eg. what happens if there are 2x John Smiths)
            // but this isn't guaranteed at this time, so the best we can do is an educated guess
            uri = user.uri || '/users/' + user.name.toLowerCase().replace(/\s+/, '-');

            return uri.charAt(0) == '/' ? uri : "/" + uri;
         })
         .append('text')
         .attr('x', tickX)
         .attr('y', tickY)
         .attr('dy', tickDY)
         .attr('fill', tickFill)
         .text(function (datum) {
            var user = JSON.parse(datum);

            return user.name
         })
         .on('mouseover', userLabelHoverHandler)
         .on('mouseout', userLabelHoverHandler);

      columnWidth = self.usersScale.bandwidth(); // columnWidth is a better name than bandwidth

      tickGroup.selectAll(".tick text")
         .call(self.wrap, columnWidth);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLegend = function () {
      var self = this, legendItem, legendGroup, legendHoverHandler;

      legendGroup = self.contentGroup.append('g')
         .attr('class', 'legend');

      legendHoverHandler = function (columnName, group, c) {
         var segments, isEnter;

         isEnter = d3.event.type == 'mouseover';

         d3.select(d3.event.target.parentNode)
            .classed("highlight", isEnter);

         segments = self.svg.selectAll('.tag-' + columnName)
            .selectAll('rect.filled, text.filled');

         if (segments.size() > 0) {
            segments.classed("highlight", isEnter);
         } else {
            self.setNotice(isEnter ? 'No "' + self.toUpperCase(columnName.replace('_', ' ')) + '" contributions' : '');
         }
      };

      legendItem = legendGroup.selectAll(".legendItem")
         .data(self.workTypes.slice().reverse())
         .enter().append("g")
         .attr("class", "legendItem")
         .attr("class", function (columnName, i) {
            return 'legend-' + columnName;
         })
         .attr("transform", function (d, i) {
            return "translate(0," + i * 20 + ")";
         })
         .style("font", "10px sans-serif")
         .on('mouseover', legendHoverHandler)
         .on('mouseout', legendHoverHandler);

      legendItem.append("rect")
         .attr("x", self.bounds.getInnerWidth() - 18)
         .attr("width", 18)
         .attr("height", 18)
         .attr("fill", this.colorScale);

      legendItem.append("text")
         .attr("x", self.bounds.getInnerWidth() - 24)
         .attr("y", 9)
         .attr("dy", ".35em")
         .attr("text-anchor", "end")
         .text(function (columnName) {
            return self.toUpperCase(columnName.replace('_', ' '));
         });
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructNoticeOverlay = function () {
      var self = this, noticeGroup;

      noticeGroup = self.svg.append('g')
         .attr('class', 'notice-label');

      noticeGroup
         .append('rect')
         .attr('x', self.bounds.getInnerWidth() / 2)
         .attr('y', self.bounds.getInnerHeight() / 2);
      noticeGroup
         .append('text')
         .attr('x', self.bounds.getInnerWidth() / 2)
         .attr('y', self.bounds.getInnerHeight() / 2);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.setNotice = function (msg) {
      var self = this, textSelection, rectSelection, padding;

      textSelection = self.svg.select('.notice-label text');

      textSelection.text(msg);

      padding = 10;

      rectSelection = self.svg.select('.notice-label rect');
      rectSelection.attr('x', textSelection.node().getBBox().x - padding);
      rectSelection.attr('y', textSelection.node().getBBox().y - padding);

      if (msg.length > 0) {
         rectSelection.attr('width', textSelection.node().getBBox().width + padding * 2);
         rectSelection.attr('height', textSelection.node().getBBox().height + padding * 2);
      } else {
         rectSelection.attr('width', 0);
         rectSelection.attr('height', 0);
      }
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.toUpperCase = function (string) {
      return string.split(/\s/g).map(function (word) {
         return word[0].toUpperCase() + word.slice(1);
      }).join(' ')
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.countChanges = function (datum) {
      var total = 0;

      for (var type in datum.workflow_changes)
         total += datum.workflow_changes[type];

      return total;
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.wrap = function (text, width) {
      text.each(function () {
         var text, words, word, line, lineNumber, lineHeight, y, dy, tspan;

         text = d3.select(this);
         words = text.text().split(/\s+/);

         line = [];
         lineNumber = 0;
         lineHeight = 1.1; // ems
         y = text.attr("y");
         dy = parseFloat(text.attr("dy"));
         tspan = text.text(null)
            .append("tspan")
            .attr("x", 0)
            .attr("y", y)
            .attr("dy", dy + "em");

         while (word = words.shift()) {
            line.push(word);
            tspan.text(line.join(" "));

            if (tspan.node().getComputedTextLength() > width) {
               line.pop();
               tspan.text(line.join(" "));
               line = [word];
               tspan = text.append("tspan")
                  .attr("x", 0)
                  .attr("y", y)
                  .attr("dy", ++lineNumber * lineHeight + dy + "em")
                  .text(word);
            }
         }
      });
   };
})();

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