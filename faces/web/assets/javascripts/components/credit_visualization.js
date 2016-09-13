ko.components.register('credit_visualization', {
   template: ' <svg width="960" height="500"></svg>',

   /**
    */
   viewModel: function (params) {
      var self = this;

      // STATE
      self.grapher = new CWRC.CreditVisualization.StackedColumnGraph();

      self.getWorkData = function (id) {
         var multiUserMultiDoc = {
            documents: [
               {
                  id: 10,
                  name: 'Nellie McClung',
                  modrecords: [
                     {
                        user: {id: 1, name: 'Bob'},
                        changes: {
                           write: 1000,
                           edit: 200
                        }
                     },
                     {
                        user: {id: 2, name: 'Dot'},
                        changes: {
                           write: 5000,
                           edit: 100
                        }
                     }
                  ]
               },
               {
                  id: 11, name: 'Emily Murphy',
                  modrecords: [
                     {
                        user: {id: 3, name: 'Phong'},
                        changes: {
                           write: 100,
                           edit: 2000
                        }
                     },
                     {
                        user: {id: 4, name: 'Enzo'},
                        changes: {
                           write: 100,
                           edit: 0
                        }
                     }
                  ]
               }
            ]
         };

         var multiUserSingleDoc = multiUserMultiDoc.documents[0];

         var singleUserSingleDoc = multiUserSingleDoc.modrecords[0];

         self.grapher.data(multiUserSingleDoc.modrecords);

         // TODO: actually call the server
         //ajax('post', '/users/' + id, '', function (response) {
         //   self.data(response);
         //});
      };

      self.getWorkData();
      self.grapher.render();
   }
});

var CWRC = CWRC || {};
CWRC.CreditVisualization = CWRC.CreditVisualization || {};

(function () {
   CWRC.CreditVisualization.StackedColumnGraph = function () {
      var self = this;

      var svg = d3.select("svg");

      this.data = ko.observable();

      this.bounds = {
         margin: {top: 20, right: 20, bottom: 60, left: 40},
         getOuterWidth: function () {
            return +svg.attr("width");
         },
         getOuterHeight: function () {
            return +svg.attr("height");
         },
         getInnerWidth: function () {
            return +svg.attr("width") - self.bounds.margin.left - self.bounds.margin.right;
         },
         getInnerHeight: function () {
            return +svg.attr("height") - self.bounds.margin.top - self.bounds.margin.bottom;
         }
      };
      this.contentGroup = svg.append("g").attr("transform", "translate(" + this.bounds.margin.left + "," + this.bounds.margin.top + ")");

      this.usersScale = d3.scaleBand()
         .rangeRound([0, this.bounds.getInnerWidth()])
         .padding(0.1)
         .align(0.1);

      this.contributionScale = d3.scaleLinear()
         .rangeRound([this.bounds.getInnerHeight(), 0]);

      this.colorScale = d3.scaleOrdinal()
         .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.render = function () {
      var self = this;

      var data, contentGroupVM, workTypeStacker, workTypes, allChangesCount;

      workTypes = ['write', 'edit']; // TODO: dynamically determine this based on the workflow keys

      data = self.data();

      data.sort(function (a, b) {
         return self.countChanges(b) - self.countChanges(a)
      });

      self.usersScale.domain(data.map(function (d) {
         return d.user.name;
      }));
      self.contributionScale.domain([0, 1]);
      self.colorScale.domain(workTypes);

      allChangesCount = d3.sum(data, function (d) {
         return self.countChanges(d);
      });

      workTypeStacker = d3.stack().keys(workTypes)
         .value(function (datum, key) {
            return datum.changes[key] / allChangesCount;
         });

      // create one group for each work type
      contentGroupVM = self.contentGroup.selectAll(".serie").data(workTypeStacker(data));

      contentGroupVM.enter().append("g")
         .attr("class", "serie")
         .attr("fill", function (d) {
            return self.colorScale(d.key);
         })
         .selectAll("rect")
         .data(function (d) {
            return d;
         })
         .enter().append("rect")
         .attr("x", function (d) {
            return self.usersScale(d.data.user.name);
         })
         .attr("y", function (d) {
            return self.contributionScale(d[1]);
         })
         .attr("height", function (d) {
            return self.contributionScale(d[0]) - self.contributionScale(d[1]);
         })
         .attr("width", self.usersScale.bandwidth())
         .on("mouseover", function (d, rowNumber, group) {
            d3.select('.legend-' + d3.select(this.parentNode).datum().key).classed('highlight', true)

            d3.select(d3.event.target).classed("highlight", true);
         })
         .on("mouseout", function () {
            d3.select('.legend-' + d3.select(this.parentNode).datum().key).classed('highlight', false)

            d3.select(d3.event.target).classed("highlight", false);
         });

      this.constructBottomScale(workTypes);
      this.constructLeftScale(workTypes);
      this.constructLegend(workTypes);

      self.contentGroup.append('text')
         .text('User Contributions by Type')
         .attr('text-anchor', 'middle')
         .attr('x', (self.bounds.getInnerWidth() / 2))
         .attr('y', self.bounds.getOuterHeight() - (self.bounds.margin.bottom / 2))
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructBottomScale = function (workTypes) {
      var self = this;

      console.log()

      self.contentGroup.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", "translate(0," + self.bounds.getInnerHeight() + ")")
         .call(d3.axisBottom(self.usersScale));
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLeftScale = function () {
      var self = this;

      var ticks = d3.axisLeft(self.contributionScale)
         .ticks(10, "s")
         .tickFormat(d3.format(".0%"));

      self.contentGroup.append("g")
         .attr("class", "axis axis--y")
         .call(ticks)
         .append("text")
         .attr("x", 2)
         .attr("y", self.contributionScale(self.contributionScale.ticks(10).pop()))
         .attr("dy", "0.35em")
         .attr("text-anchor", "start")
         .attr("fill", "#000")
         .text("Contribution");
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLegend = function (workTypes) {
      var self = this, legendItem, legendGroup;

      legendGroup = self.contentGroup.append('g')
         .attr('class', 'legend');

      legendItem = legendGroup.selectAll(".legendItem")
         .data(workTypes.reverse())
         .enter().append("g")
         .attr("class", "legendItem")
         .attr("class", function (columnName, i) {
            return 'legend-' + columnName;
         })
         .attr("transform", function (d, i) {
            return "translate(0," + i * 20 + ")";
         })
         .style("font", "10px sans-serif");

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
            return columnName.toUpperCase()[0] + columnName.slice(1);
         });
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.countChanges = function (datum) {
      var total = 0;

      for (var type in datum.changes)
         total += datum.changes[type];

      return total;
   };
})();