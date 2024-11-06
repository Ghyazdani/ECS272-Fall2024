import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { hexbin as d3Hexbin, HexbinBin } from 'd3-hexbin';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';

interface DataType {
  CreditScore: number;
  Income: number;
  RiskRating: string;
  DebtToIncomeRatio: number;
  Age: number;
}

// Extend the HexbinBin interface to include avgDebtToIncomeRatio
interface ExtendedHexbinBin extends HexbinBin<DataType> {
  avgDebtToIncomeRatio: number;
}

export default function HexbinPlot() {
  const scatterRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataType[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const margin = { top: 80, right: 60, bottom: 120, left: 80 };
  const onResize = useDebounceCallback((size) => setSize(size), 200);
  useResizeObserver({ ref: scatterRef, onResize });

  // Age groups
  const ageGroups = [
    { min: 18, max: 27, label: '18-27' },
    { min: 28, max: 37, label: '28-37' },
    { min: 38, max: 47, label: '38-47' },
    { min: 48, max: 57, label: '48-57' },
    { min: 58, max: 69, label: '58-69' },
  ];

  const [ageGroupIndex, setAgeGroupIndex] = useState(0);

  // References to D3 elements and variables
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined>>();
  const xScaleRef = useRef<d3.ScaleLinear<number, number>>();
  const yScaleRef = useRef<d3.ScaleLinear<number, number>>();
  const hexbinGeneratorRef = useRef<d3.Hexbin<DataType>>();
  const colorScaleRef = useRef<d3.ScaleSequential<string>>();
  const chartInitializedRef = useRef(false);

  // Load the CSV data
  useEffect(() => {
    d3.csv('/data/financial_risk_assessment.csv', (d) => {
      const creditScore = +d['Credit Score'];
      const income = +d['Income'];
      const riskRating = d['Risk Rating'];
      const debtToIncomeRatio = +d['Debt-to-Income Ratio'];
      const age = +d['Age'];

      if (
        !isNaN(creditScore) &&
        !isNaN(income) &&
        !isNaN(debtToIncomeRatio) &&
        !isNaN(age) &&
        creditScore >= 600 &&
        creditScore <= 800 &&
        income > 0 &&
        riskRating
      ) {
        return {
          CreditScore: creditScore,
          Income: income,
          RiskRating: riskRating,
          DebtToIncomeRatio: debtToIncomeRatio,
          Age: age,
        } as DataType;
      }
      return null;
    }).then((loadedData) => {
      const validData = loadedData.filter((d) => d !== null) as DataType[];
      setData(validData);
    });
  }, []);

  // Initialize chart only once when data and size are available
  useEffect(() => {
    if (data.length === 0 || size.width === 0 || size.height === 0) return;

    initChart();
  }, [data, size]);

  // Update chart when age group changes
  useEffect(() => {
    if (!chartInitializedRef.current) return;
    updateChart();
  }, [ageGroupIndex]);

  // Set up interval to change age group index
  useEffect(() => {
    const interval = setInterval(() => {
      setAgeGroupIndex((prevIndex) => (prevIndex + 1) % ageGroups.length);
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, []);

  function initChart() {
    if (chartInitializedRef.current) return;

    const svg = d3
      .select('#hexbin-svg')
      .attr('width', size.width)
      .attr('height', size.height);

    svgRef.current = svg;

    const xScale = d3
      .scaleLinear()
      .domain([600, 800])
      .range([margin.left, size.width - margin.right]);

    const yMin = d3.min(data, (d) => d.Income)!;
    const yMax = d3.max(data, (d) => d.Income)!;
    const yBuffer = (yMax - yMin) * 0.05;

    const yScale = d3
      .scaleLinear()
      .domain([yMin - yBuffer, yMax + yBuffer])
      .range([size.height - margin.bottom, margin.top]);

    xScaleRef.current = xScale;
    yScaleRef.current = yScale;

    // Create a hexbin generator
    const hexbinGenerator = d3Hexbin<DataType>()
      .x((d) => xScale(d.CreditScore))
      .y((d) => yScale(d.Income))
      .radius(10)
      .extent([
        [margin.left, margin.top],
        [size.width - margin.right, size.height - margin.bottom],
      ]);

    hexbinGeneratorRef.current = hexbinGenerator;

    // Initialize color scale (we'll set the domain globally)
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn);
    colorScaleRef.current = colorScale;

    // Compute global min and max Debt-to-Income Ratio for consistent color mapping
    const globalMinRatio = d3.min(data, (d) => d.DebtToIncomeRatio)!;
    const globalMaxRatio = d3.max(data, (d) => d.DebtToIncomeRatio)!;

    colorScale.domain([globalMaxRatio, globalMinRatio]);

    // Store global min and max for legend updates
    colorScaleRef.current['globalMinRatio'] = globalMinRatio;
    colorScaleRef.current['globalMaxRatio'] = globalMaxRatio;

    // Create hexagons group
    svg.append('g').attr('class', 'hexagons');

    // Add X-axis
    svg
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    // Add Y-axis
    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale));

    // Add X-axis label
    svg
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', size.height - margin.bottom + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .text('Credit Score');

    // Add Y-axis label
    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -size.height / 2)
      .attr('y', margin.left - 60)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .text('Income');

    // Add chart title
    svg
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Credit Score vs. Income Hexbin Plot');

    // Add age group label
    svg
      .append('text')
      .attr('class', 'age-group-label')
      .attr('x', size.width / 2)
      .attr('y', margin.top)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold');

    // Add legend elements
    const legendGroup = svg
      .append('g')
      .attr(
        'transform',
        `translate(${(size.width - 300) / 2}, ${size.height - margin.bottom + 70})`
      )
      .attr('class', 'legend-group');

    // Define the gradient for the legend
    const defs = svg.append('defs');

    const linearGradient = defs
      .append('linearGradient')
      .attr('id', 'legend-gradient');

    linearGradient
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    linearGradient
      .selectAll('stop')
      .data([
        { offset: '0%', color: colorScale(globalMaxRatio) }, // Red (high risk)
        { offset: '100%', color: colorScale(globalMinRatio) }, // Green (low risk)
      ])
      .enter()
      .append('stop')
      .attr('offset', (d) => d.offset)
      .attr('stop-color', (d) => d.color);

    legendGroup
      .append('rect')
      .attr('width', 300)
      .attr('height', 10)
      .style('fill', 'url(#legend-gradient)');

    legendGroup
      .append('g')
      .attr('transform', `translate(0, 10)`)
      .attr('class', 'legend-axis');

    legendGroup
      .append('text')
      .attr('x', 150)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .text('Average Debt-to-Income Ratio');

    // Initialize legend axis
    const legendScale = d3
      .scaleLinear()
      .domain([globalMaxRatio, globalMinRatio])
      .range([0, 300]);

    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format('.2f'));

    svg
      .select('.legend-group')
      .select('.legend-axis')
      .call(legendAxis);

    chartInitializedRef.current = true;

    // Initial chart update
    updateChart();
  }

  function updateChart() {
    const svg = svgRef.current!;
    const xScale = xScaleRef.current!;
    const yScale = yScaleRef.current!;
    const hexbinGenerator = hexbinGeneratorRef.current!;
    const colorScale = colorScaleRef.current!;

    const currentAgeGroup = ageGroups[ageGroupIndex];

    const filteredData = data.filter(
      (d) => d.Age >= currentAgeGroup.min && d.Age <= currentAgeGroup.max
    );

    // Recompute bins
    const bins = hexbinGenerator(filteredData) as ExtendedHexbinBin[];

    if (bins.length === 0) {
      // Handle case where there is no data for the age group
      svg.select('.hexagons').selectAll('path').remove();
      svg.select('.age-group-label').text(`Age Group: ${currentAgeGroup.label} (No data)`);
      return;
    }

    // Calculate the average Debt-to-Income Ratio for each bin
    bins.forEach((bin) => {
      const validRatios = bin
        .map((d) => d.DebtToIncomeRatio)
        .filter((ratio) => !isNaN(ratio));
      bin.avgDebtToIncomeRatio = d3.mean(validRatios)!;
    });

    // Remove bins with invalid average Debt-to-Income Ratio
    const validBins = bins.filter((bin) => !isNaN(bin.avgDebtToIncomeRatio));

    // Update hexagons
    const hexagons = svg
      .select('.hexagons')
      .selectAll('path')
      .data(validBins, (d) => `${d.x}-${d.y}`);

    hexagons
      .exit()
      .transition()
      .duration(1000)
      .style('opacity', 0)
      .remove();

    hexagons
      .enter()
      .append('path')
      .attr('d', (d) => hexbinGenerator.hexagon())
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('fill', (d) => colorScale(d.avgDebtToIncomeRatio))
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)
      .style('opacity', 0)
      .transition()
      .duration(1000)
      .style('opacity', 1);

    hexagons
      .transition()
      .duration(1000)
      .attr('d', (d) => hexbinGenerator.hexagon())
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('fill', (d) => colorScale(d.avgDebtToIncomeRatio));

    // Update age group label
    svg.select('.age-group-label').text(`Age Group: ${currentAgeGroup.label}`);
  }

  return (
    <div
      ref={scatterRef}
      className="chart-container"
      style={{ width: '100%', height: '500px' }}
    >
      <svg id="hexbin-svg"></svg>
    </div>
  );
}
