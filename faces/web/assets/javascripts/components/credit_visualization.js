ko.components.register('credit_visualization', {
   template: ' <svg width="960" height="500"></svg>',

   /**
    */
   viewModel: function (params) {
      var self = this;

      // STATE
      self.data = ko.observableArray();

      self.grapher = new CWRC.CreditVisualization.StackedColumnGraph(self.data);

      self.getWorkData = function (id) {
         //var projects = [{
         //   objects_meta: [{
         //      id: 'cba-321',
         //      name: 'Kelly Oxford',
         //      editors: [
         //         {
         //            id: 1,
         //            name: 'Bob'
         //         },
         //         {
         //            id: 2,
         //            name: 'Dot'
         //         }
         //      ]
         //   }]
         //}];

         //self.data(projects[0].objects_meta[0].editors);

         // all users' changes to a single object
         self.data([
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
            },
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
         ]);

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
   CWRC.CreditVisualization.StackedColumnGraph = function (dataSetOservable) {
      var self = this;

      var svg = d3.select("svg");

      this.data = dataSetOservable;

      this.bounds = {
         margin: {top: 20, right: 20, bottom: 30, left: 30},
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

      var data, contentGroupVM, workTypeStacker, workTypes;

      workTypes = ['write', 'edit']; // TODO: dynamically determine this based on the workflow keys

      data = self.data();

      data.sort(function (a, b) {
         return self.totalChanges(b) - self.totalChanges(a)
      });

      self.usersScale.domain(data.map(function (d) {
         return d.user.name;
      }));
      self.contributionScale.domain([0, d3.max(data, function (d) {
         return self.totalChanges(d);
      })]).nice();
      self.colorScale.domain(workTypes);

      workTypeStacker = d3.stack().keys(workTypes)
         .value(function (datum, key) {
            return datum.changes[key];
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
         .attr("width", self.usersScale.bandwidth());

      this.constructBottomScale(workTypes);
      this.constructLeftScale(workTypes);
      this.constructLegend(workTypes);
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructBottomScale = function (workTypes) {
      var self = this;

      self.contentGroup.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", "translate(0," + this.bounds.getInnerHeight() + ")")
         .call(d3.axisBottom(this.usersScale));
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLeftScale = function () {
      var self = this;

      self.contentGroup.append("g")
         .attr("class", "axis axis--y")
         .call(d3.axisLeft(self.contributionScale).ticks(10, "s"))
         .append("text")
         .attr("x", 2)
         .attr("y", self.contributionScale(self.contributionScale.ticks(10).pop()))
         .attr("dy", "0.35em")
         .attr("text-anchor", "start")
         .attr("fill", "#000")
         .text("Contribution");
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.constructLegend = function (workTypes) {
      var self = this, legend;

      legend = self.contentGroup.selectAll(".legend")
         .data(workTypes.reverse())
         .enter().append("g")
         .attr("class", "legend")
         .attr("transform", function (d, i) {
            return "translate(0," + i * 20 + ")";
         })
         .style("font", "10px sans-serif");

      legend.append("rect")
         .attr("x", self.bounds.getInnerWidth() - 18)
         .attr("width", 18)
         .attr("height", 18)
         .attr("fill", this.colorScale);

      legend.append("text")
         .attr("x", self.bounds.getInnerWidth() - 24)
         .attr("y", 9)
         .attr("dy", ".35em")
         .attr("text-anchor", "end")
         .text(function (columnName) {
            return columnName.toUpperCase()[0] + columnName.slice(1);
         });
   };

   CWRC.CreditVisualization.StackedColumnGraph.prototype.totalChanges = function (datum) {
      var total = 0;

      for (var type in datum.changes)
         total += datum.changes[type];

      return total;
   };
})();