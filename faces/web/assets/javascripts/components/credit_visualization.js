ko.components.register('credit_visualization', {
   template: ' <svg width="960" height="500"></svg>',

   /**
    */
   viewModel: function (params) {
      var self = this;

      // STATE
      self.data = ko.observableArray();

      self.totalChanges = function (datum) {
         var total = 0;

         for (var type in datum.changes)
            total += datum.changes[type];

         return total;
      };

      self.initD3 = function () {
         var svg, margin, width, height, svgGroup, usersScale, contributionScale, colorScale, svgGroupVM;
         var stack = d3.stack();
         var legend, legendVM, data;

         svg = d3.select("svg");
         margin = {top: 20, right: 20, bottom: 30, left: 40};
         width = +svg.attr("width") - margin.left - margin.right;
         height = +svg.attr("height") - margin.top - margin.bottom;
         svgGroup = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

         usersScale = d3.scaleBand()
            .rangeRound([0, width])
            .padding(0.1)
            .align(0.1);

         contributionScale = d3.scaleLinear()
            .rangeRound([height, 0]);

         colorScale = d3.scaleOrdinal()
            .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

         data = self.data();

         data.sort(function (a, b) {
            return self.totalChanges(b) - self.totalChanges(a)
         });

         var workTypes = ['write', 'edit'];

         usersScale.domain(data.map(function (d) {
            return d.user.name;
         }));
         contributionScale.domain([0, d3.max(data, function (d) {
            return self.totalChanges(d);
         })]).nice();
         colorScale.domain(workTypes); // TODO: dynamically set this based on the workflow keys

         var stacker = stack.keys(workTypes)
            .value(function (datum, key) {
               return datum.changes[key];
            });

         // create one group for each work type
         svgGroupVM = svgGroup.selectAll(".serie").data(stacker(data));

         svgGroupVM.enter().append("g")
            .attr("class", "serie")
            .attr("fill", function (d) {
               return colorScale(d.key);
            })
            .selectAll("rect")
            .data(function (d) {
               return d;
            })
            .enter().append("rect")
            .attr("x", function (d) {
               return usersScale(d.data.user.name);
            })
            .attr("y", function (d) {
               return contributionScale(d[1]);
            })
            .attr("height", function (d) {
               return contributionScale(d[0]) - contributionScale(d[1]);
            })
            .attr("width", usersScale.bandwidth());

         // Bottom Scale
         svgGroup.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(usersScale));

         // Left Scale
         svgGroup.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(contributionScale).ticks(10, "s"))
            .append("text")
            .attr("x", 2)
            .attr("y", contributionScale(contributionScale.ticks(10).pop()))
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .attr("fill", "#000")
            .text("Contribution");


         legend = svgGroup.selectAll(".legend")
            .data(workTypes.reverse())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
               return "translate(0," + i * 20 + ")";
            })
            .style("font", "10px sans-serif");

         legend.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .attr("fill", colorScale);

         legend.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .text(function (d) {
               return d.toUpperCase()[0] + d.slice(1);
            });
      };

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
      self.initD3();
   }
});

(function () {
   function StackedColumnGraph(dataSetOservable) {
      this.data = dataSetOservable();
   }


})();