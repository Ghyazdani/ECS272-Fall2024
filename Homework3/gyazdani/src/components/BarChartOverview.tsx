import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';

interface DataType {
  Age: string;
  Income: number;
  RiskRating: string;
}

function categorizeAge(age: number): string {
  if (age >= 18 && age <= 27) return '18-27';
  if (age >= 28 && age <= 37) return '28-37';
  if (age >= 38 && age <= 47) return '38-47';
  if (age >= 48 && age <= 57) return '48-57';
  if (age >= 58 && age <= 69) return '58-69';
  return 'Unknown';
}

export default function BarChartOverview() {
  const barRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataType[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const margin = { top: 60, right: 150, bottom: 100, left: 80 };

  const onResize = useDebounceCallback((size) => setSize(size), 200);
  useResizeObserver({ ref: barRef, onResize });

  useEffect(() => {
    d3.csv('/data/financial_risk_assessment.csv', (d) => {
      const age = +d.Age;
      const ageGroup = categorizeAge(age);
      return {
        Age: ageGroup,
        Income: +d.Income,
        RiskRating: d['Risk Rating'],
      } as DataType;
    }).then((loadedData) => {
      setData(loadedData);
    });
  }, []);

  useEffect(() => {
    if (data.length === 0 || size.width === 0 || size.height === 0) return;
    d3.select('#bar-svg').selectAll('*').remove();
    initChart();
  }, [data, size]);

  function initChart() {
    const svg = d3.select('#bar-svg');
    const tooltip = d3.select(barRef.current)
      .append('div')
      .style('position', 'absolute')
      .style('padding', '6px')
      .style('background', 'rgba(0, 0, 0, 0.7)')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    const riskCategories = ['Low', 'Medium', 'High'];
    const colorScale = d3.scaleOrdinal()
      .domain(riskCategories)
      .range(['#82ca9d', '#ffc658', '#ff6f61']);

    const ageCategories = ['18-27', '28-37', '38-47', '48-57', '58-69', 'Unknown'];


    const aggregatedData = d3.rollup(
      data,
      v => ({
        totalIncome: d3.sum(v, d => d.Income),
        count: v.length,
      }),
      d => d.Age,
      d => d.RiskRating
    );

    // Filter ageCategories to include only those present in the aggregatedData
    const ageCategoriesInData = ageCategories.filter(age => aggregatedData.has(age));

    const stackedData = Array.from(aggregatedData, ([age, riskData]) => {
      const row = { Age: age };
      riskCategories.forEach((risk) => {
        const groupData = riskData.get(risk);
        row[risk] = groupData ? groupData.totalIncome / groupData.count : 0;
      });
      return row;
    });

    const xScale = d3.scaleBand()
      .range([margin.left, size.width - margin.right])
      .domain(ageCategoriesInData)
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .range([size.height - margin.bottom, margin.top])
      .domain([0, d3.max(stackedData, d => d3.sum(riskCategories, risk => d[risk]))]).nice();

    svg.append('g')
      .attr('transform', `translate(0,${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px');

    // X-Axis Label
    svg.append('text')
      .attr('x', size.width / 2)
      .attr('y', size.height - margin.bottom + 50)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Age');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

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

    const stack = d3.stack().keys(riskCategories);
    const series = stack(stackedData);

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
      .attr('width', xScale.bandwidth())
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`Average Income: ${d3.format(",.2f")(d[1] - d[0])}`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 20}px`);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

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
    <div ref={barRef} className="chart-container" style={{ position: 'relative', overflowX: 'auto' }}>
      <svg id="bar-svg" width="100%" height="100%"></svg>
    </div>
  );
}
