import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';

// Define the type for your data
interface DataType {
  Age: string;
  Income: number;
  RiskRating: string; // Could be "Low", "Medium", "High"
}

// Function to categorize age into ranges
function categorizeAge(age: number): string {
  if (age >= 18 && age <= 25) return '18-25';
  if (age >= 26 && age <= 35) return '26-35';
  if (age >= 36 && age <= 45) return '36-45';
  if (age >= 46 && age <= 55) return '46-55';
  if (age >= 56 && age <= 69) return '56-69';
  return 'Unknown'; // Fallback for ages outside the expected range
}

export default function BarChartOverview() {
  const barRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataType[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const margin = { top: 60, right: 150, bottom: 100, left: 80 };

  const onResize = useDebounceCallback((size) => setSize(size), 200);
  useResizeObserver({ ref: barRef, onResize });

  // Load the CSV data
  useEffect(() => {
    d3.csv('/data/financial_risk_assessment.csv', (d) => {
      const age = +d.Age;
      const ageGroup = categorizeAge(age); // Categorize the age

      return {
        Age: ageGroup, // Use the categorized age group instead of raw age
        Income: +d.Income,
        RiskRating: d['Risk Rating'], // Assuming Risk Rating has values like "Low", "Medium", "High"
      } as DataType;
    }).then((loadedData) => {
      setData(loadedData);
    });
  }, []);

  // Initialize chart only if data is available
  useEffect(() => {
    if (data.length === 0 || size.width === 0 || size.height === 0) return;

    d3.select('#bar-svg').selectAll('*').remove();
    initChart();
  }, [data, size]);

  function initChart() {
    const svg = d3.select('#bar-svg');

    const riskCategories = ['Low', 'Medium', 'High'];
    const colorScale = d3.scaleOrdinal()
      .domain(riskCategories)
      .range(['#82ca9d', '#ffc658', '#ff6f61']);

    // Aggregate data by Age and Risk Rating with totalIncome and count for averaging
    const aggregatedData = d3.rollup(
      data,
      v => ({
        totalIncome: d3.sum(v, d => d.Income),
        count: v.length,
      }),
      d => d.Age,
      d => d.RiskRating
    );

    // Convert aggregated data to calculate average income per person
    const stackedData = Array.from(aggregatedData, ([age, riskData]) => {
      const row = { Age: age };
      riskCategories.forEach((risk) => {
        const groupData = riskData.get(risk);
        if (groupData) {
          row[risk] = groupData.totalIncome / groupData.count; // Calculate average income
        } else {
          row[risk] = 0; // Default to 0 if no data for this risk category
        }
      });
      return row;
    });

    // Debugging: Log stacked data to verify structure
    console.log('Stacked Data:', stackedData);

    const xScale = d3.scaleBand()
      .range([margin.left, size.width - margin.right])
      .domain(stackedData.map(d => d.Age))
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .range([size.height - margin.bottom, margin.top])
      .domain([0, d3.max(stackedData, d => d3.sum(riskCategories, risk => d[risk]))]).nice();

    // X-axis
    svg.append('g')
      .attr('transform', `translate(0,${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    // Update chart title and labels
    svg.append('text')
      .attr('x', size.width / 2)
      .attr('y', margin.top - 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '15px')
      .style('font-weight', 'bold')
      .text('Average Income per Person by Age and Risk Rating');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(size.height / 2))
      .attr('y', margin.left - 70)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Average Income per Person');

    // Stack the data by Risk Rating
    const stack = d3.stack().keys(riskCategories);
    const series = stack(stackedData);

    // Draw the stacked bar chart
    svg.append('g')
      .selectAll('g')
      .data(series)
      .enter().append('g')
      .attr('fill', d => colorScale(d.key))
      .selectAll('rect')
      .data(d => d)
      .enter().append('rect')
      .attr('x', d => xScale(d.data.Age)!)
      .attr('y', d => yScale(d[1]))
      .attr('height', d => yScale(d[0]) - yScale(d[1]))
      .attr('width', xScale.bandwidth());

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${size.width - margin.right + 10}, ${margin.top})`);

    legend.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('text-anchor', 'start')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Risk Rating');

    riskCategories.forEach((category, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 20)
        .attr('width', 18)
        .attr('height', 18)
        .attr('fill', colorScale(category));

      legend.append('text')
        .attr('x', 25)
        .attr('y', i * 20 + 13)
        .style('text-anchor', 'start')
        .style('font-size', '12px')
        .text(category);
    });
  }

  return (
    <>
      <div ref={barRef} className="chart-container" style={{ overflowX: 'auto' }}>
        <svg id="bar-svg" width="100%" height="100%"></svg>
      </div>
    </>
  );
}
