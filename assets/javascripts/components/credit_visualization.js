ko.components.register('credit_visualization', {
   template: ' <div data-bind="attr: {id: id()}">\
                  <svg width="1024" height="500" ></svg>\
               </div>',

   /**
    */
   viewModel: function (params) {
      var self = this;

      self.id = ko.observable(params.id || 'creditvis');

      // STATE

      // BEHAVIOUR
      self.getWorkData = function (id) {
         self.grapher = new CWRC.CreditVisualization.StackedColumnGraph('#' + self.id() + ' svg');

         // TODO: actually call the appropriate endpoint
         ajax('get', '/data/contribution_data.json', '', function (response) {
            var data, title, multiUser, multiDoc;

            // multiUserMultiDoc = response;
            // multiUserSingleDoc = multiUserMultiDoc.documents[0];
            // singleUserSingleDoc = multiUserSingleDoc.documents[0].modifications[0];

            multiUser = true;
            multiDoc = true;
            multiDoc = !params.isDoc;//false;

            if (multiUser && multiDoc) {
               data = response.documents.reduce(function (aggregate, document) {
                  return aggregate.concat(document.modifications);
               }, []);

               title = 'User Contributions to "' + response.name + '", by Type';
            } else if (multiUser && !multiDoc) {
               var doc = response.documents[0];

               data = doc.modifications;

               title = 'User Contributions to "' + doc.name + '", by Type';
            }

            self.grapher.render(data, title, params.mergeTags || {}, params.ignoreTags);
         });
      };

      window.setTimeout(function () {
         self.getWorkData();
      });
   }
});

var CWRC = CWRC || {};
CWRC.CreditVisualization = CWRC.CreditVisualization || {};

(function StackedColumnGraph() {
   CWRC.CreditVisualization.StackedColumnGraph = function (svgSelector) {
      var self = this;

      self.svg = d3.select(svgSelector);

      var workflowCategoriesToStamps = {
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

      this.workTypes = Object.keys(workflowCategoriesToStamps);

      this.bounds = {
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
      this.contentGroup = self.svg.append("g");

      this.contentGroup.attr("transform", "translate(" + this.bounds.padding.left + "," + this.bounds.padding.top + ")");

      this.usersScale = d3.scaleBand()
         .rangeRound([0, this.bounds.getInnerWidth() - this.bounds.legendWidth])
         .padding(0.1)
         .align(0.1);

      this.contributionScale = d3.scaleLinear()
         .rangeRound([this.bounds.getInnerHeight(), 0]);

      this.colorScale = d3.scaleOrdinal(d3.schemeCategory20c);
      //.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.render = function (data, title, mergedTagMap, ignoredTags) {
      var self = this;

      var stackVM, workTagStacker, workTagStack, allChangesCount, seriesGroupVM, percentFormat, maxValue, segmentHoverHandler;

      // removing the types from the list will mean that the Ordinal Scale will ignore those values.
      (Object.keys(mergedTagMap).concat(ignoredTags)).forEach(function (tag) {
         self.workTypes.splice(self.workTypes.indexOf(tag), 1)
      });

      self.sanitize(data, mergedTagMap);

      data.sort(function (a, b) {
         return self.countChanges(b) - self.countChanges(a)
      });

      allChangesCount = d3.sum(data, function (d) {
         return self.countChanges(d);
      });

      workTagStacker = d3.stack()
         .keys(self.workTypes)
         .value(function (datum, key) {
            return (datum.workflow_changes[key] || 0) / allChangesCount
         });

      workTagStack = workTagStacker(data);

      maxValue = d3.max(workTagStack.reduce(function (a, b) {
         return a.concat(b.reduce(function (c, d) {
            return c.concat(d);
         }, []));
      }, []));

      self.usersScale.domain(data.map(function (d) {
         return JSON.stringify(d.user);
      }));
      self.contributionScale.domain([0, maxValue]).nice();
      self.colorScale.domain(self.workTypes);

      // create one group for each work type
      stackVM = self.contentGroup.selectAll('.series')
         .data(workTagStack);

      seriesGroupVM = stackVM.enter().append("g")
         .attr("class", function (datum) {
            return "series tag-" + datum.key;
         })
         .attr("fill", function (d) {
            return self.colorScale(d.key);
         })
         .filter(self.hasSize); // removing the empties cleans up the graph DOM for other conditionals

      segmentHoverHandler = function (d, rowNumber, group) {
         var keyName, isEnter;
         isEnter = d3.event.type == 'mouseover';

         keyName = d3.select(this.parentNode).datum().key;

         d3.select(d3.event.target).classed("highlight", isEnter);

         self.svg.select('.legend-' + keyName)
            .classed('highlight', isEnter);

         self.svg.selectAll('.tag-' + keyName + ' text')
            .filter(function (d, labelRowNumber, f) {
               return rowNumber == labelRowNumber;
            })
            .classed('highlight', isEnter);
      };

      seriesGroupVM.selectAll("rect")
         .data(function (d) {
            return d;
         })
         .enter().append("rect")
         .attr("x", function (d) {
            return self.usersScale(JSON.stringify(d.data.user));
         })
         .attr("y", function (dataRow) {
            return self.contributionScale(dataRow[1]);
         })
         .attr("height", function (dataRow) {
            return self.contributionScale(dataRow[0]) - self.contributionScale(dataRow[1]);
         })
         .attr("width", self.usersScale.bandwidth())
         .on("mouseover", segmentHoverHandler)
         .on("mouseout", segmentHoverHandler);

      percentFormat = d3.format(".00%");

      stackVM.enter().append("g")
         .attr("class", function (datum) {
            return "labels tag-" + datum.key;
         })
         .filter(self.hasSize)
         .selectAll("text")
         .data(function (d) {
            return d;
         })
         .enter().append("text")
         .text(function (d) {
            var value = d[1] - d[0];

            return value > 0 ? percentFormat(value) : '';
         })
         .attr("x", function (d) {
            return self.usersScale(JSON.stringify(d.data.user)) + self.usersScale.bandwidth() / 2;
         })
         .attr("y", function (dataRow) {
            var baseline = self.contributionScale(dataRow[0]);
            var top = self.contributionScale(dataRow[1]);

            return baseline + (top - self.contributionScale(dataRow[0])) / 2;
         });

      maxValue = d3.max(workTagStack.reduce(function (a, b) {
         return a.concat(b.reduce(function (c, d) {
            return c.concat(d);
         }, []));
      }, []));


      // per-user maxiumums
      self.contentGroup.selectAll('.total-labels')
         .data(data)
         .enter()
         .append('g')
         .attr("class", function (datum) {
            return "total-labels total-label-user-" + datum.user.id;
         })
         .append("text")
         .text(function (d) {
            return percentFormat(self.countChanges(d) / allChangesCount);
         })
         .attr('x', function (d) {
            return self.usersScale(JSON.stringify(d.user)) + self.usersScale.bandwidth() / 2;
         })
         .attr('y', function (datum, index) {
            var finalStackRow, userSegment, segmentTop;

            // each stack row is all segments within a category, so last one is top
            finalStackRow = workTagStack[workTagStack.length - 1];
            userSegment = finalStackRow[index]; // the value pair for this column
            segmentTop = userSegment[1];

            return self.contributionScale(segmentTop) - 4;
         });

      this.constructBottomScale();
      this.constructLeftScale();
      this.constructLegend();
      this.constructTitle(title);
      this.constructNoticeOverlay()
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.sanitize = function (data, mergedTagMap) {
      var self = this, changeset;

      // merge all mods from the same user
      var removable = [];

      data.forEach(function (modification, i) {
         var firstRecord = data.find(function (other) {
            return other.user.id == modification.user.id;
         });

         if (!(firstRecord === modification)) {
            for (var key in modification.workflow_changes) {
               firstRecord.workflow_changes[key] = (firstRecord.workflow_changes[key] || 0) + modification.workflow_changes[key];
            }

            removable.push(modification);
         }
      });

      removable.forEach(function (modification) {
         data.splice(data.indexOf(modification), 1)
      });

      data.forEach(function (modification) {
         changeset = modification.workflow_changes;

         for (var mergedTag in mergedTagMap) {
            var primaryTag = mergedTagMap[mergedTag];

            changeset[primaryTag] = (changeset[primaryTag] || 0) + (changeset[mergedTag] || 0);
            changeset[mergedTag] = 0;
         }
      });
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.hasSize = function (stackGroup) {
      return stackGroup.some(function (positionsRow) {
         return positionsRow[0] != positionsRow[1];
      })
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructBottomScale = function () {
      var self = this;

      var axis, tickGroup, existingTickLabels, tickFill, tickX, tickY, tickDY, columnWidth, userLabelHoverHandler;

      axis = d3.axisBottom(self.usersScale)
         .tickFormat(function (datum) {
            return JSON.parse(datum).name;
         });

      tickGroup = self.contentGroup.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", "translate(0," + self.bounds.getInnerHeight() + ")")
         .call(axis);

      /*
       * replacing each label text with an anchor because we can't change
       * the tick construction process to use anchors instead
       */
      existingTickLabels = tickGroup.selectAll('.tick > text');
      tickFill = existingTickLabels.attr('fill');
      tickX = existingTickLabels.attr('x');
      tickY = existingTickLabels.attr('y');
      tickDY = existingTickLabels.attr('dy');
      existingTickLabels.remove();

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
            var user_uri = JSON.parse(datum).uri || '';

            return user_uri.charAt(0) == '/' ? user_uri : "/" + user_uri;
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


      columnWidth = self.usersScale.bandwidth(); // labelling for clarity

      tickGroup.selectAll(".tick text")
         .call(self.wrap, columnWidth);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLeftScale = function () {
      var self = this, ticks, tickLine;

      ticks = d3.axisLeft(self.contributionScale)
         .ticks(10, "s")
         .tickFormat(d3.format(".0%"));

      tickLine = self.contentGroup.append("g")
         .attr("class", "axis axis--y")
         .call(ticks);

      tickLine
         .append("text")
         .attr("x", 0)
         .attr("y", self.contributionScale(self.contributionScale.ticks(10).pop()) - 10)
         .attr("text-anchor", "right")
         .attr("fill", "#000")
         .text("Contribution");
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLegend = function () {
      var self = this, legendItem, legendGroup, legendHoverHandler;

      legendGroup = self.contentGroup.append('g')
         .attr('class', 'legend');

      legendHoverHandler = function (datum, group, c) {
         var segments, isEnter;

         isEnter = d3.event.type == 'mouseover';

         d3.select(d3.event.target.parentNode)
            .classed("highlight", isEnter);

         segments = self.svg.selectAll('.tag-' + datum)
            .selectAll('rect, text');

         if (segments.size() > 0) {
            segments.classed("highlight", isEnter);
         } else {
            self.setNotice(isEnter ? 'No "' + self.toUpperCase(datum) + '" contributions' : '');
         }
      };

      legendItem = legendGroup.selectAll(".legendItem")
         .data(self.workTypes.reverse())
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
         .attr("fill", this.colorScale)

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

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructTitle = function (title) {
      var self = this;

      self.contentGroup.append('text')
         .text(title)
         .attr('text-anchor', 'middle')
         .attr('x', (self.bounds.getInnerWidth() / 2))
         .attr('y', self.bounds.getOuterHeight() - (self.bounds.padding.bottom / 2));
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
   }
})();
