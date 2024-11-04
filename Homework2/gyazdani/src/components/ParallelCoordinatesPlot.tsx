import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';

interface DataType {
  EducationLevel: string;
  PaymentHistory: string;
  Income: string;
  RiskRating: string;
}

export default function ParallelCoordinatesPlot() {
  const scatterRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataType[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Increased top margin to make room for the title
  const margin = { top: 80, right: 60, bottom: 100, left: 60 };
  const onResize = useDebounceCallback((size) => setSize(size), 200);
  useResizeObserver({ ref: scatterRef, onResize });

  // Define income ranges
  const incomeRanges = [
    '< 20K',
    '20K - 50K',
    '50K - 100K',
    '100K - 200K',
    '> 200K',
  ];

  // Helper function to assign income to a range
  const assignIncomeToRange = (income: number) => {
    if (income < 20000) return '< 20K';
    if (income >= 20000 && income < 50000) return '20K - 50K';
    if (income >= 50000 && income < 100000) return '50K - 100K';
    if (income >= 100000 && income < 200000) return '100K - 200K';
    return '> 200K';
  };

  // Load the CSV data
  useEffect(() => {
    d3.csv('/data/financial_risk_assessment.csv', (d) => {
      const educationLevel = d['Education Level'];
      const paymentHistory = d['Payment History'];
      const income =
        d['Income'] && d['Income'].trim() !== '' ? +d['Income'] : NaN;
      const riskRating = d['Risk Rating'];

      if (educationLevel && paymentHistory && !isNaN(income) && riskRating) {
        return {
          EducationLevel: educationLevel,
          PaymentHistory: paymentHistory,
          Income: assignIncomeToRange(income),
          RiskRating: riskRating,
        } as DataType;
      }
      return null;
    }).then((loadedData) => {
      const validData = loadedData.filter((d) => d !== null) as DataType[];
      setData(validData);
    });
  }, []);

  // Initialize chart only if data is available
  useEffect(() => {
    if (data.length === 0 || size.width === 0 || size.height === 0) return;

    d3.select('#parallel-coordinates-svg').selectAll('*').remove();
    initChart();
  }, [data, size]);

  function initChart() {
    const svg = d3
      .select('#parallel-coordinates-svg')
      .attr('width', size.width)
      .attr('height', size.height);

    const dimensions = [
      'EducationLevel',
      'PaymentHistory',
      'Income',
      'RiskRating',
    ];
    const axisLabels = ['Education', 'Payment History', 'Income', 'Risk Rating'];

    // Generate nodes and links for the sankey diagram
    const nodesSet = new Set<string>();
    const linksMap = new Map<
      string,
      { source: string; target: string; value: number }
    >();

    data.forEach((d) => {
      dimensions.reduce((prevDimension, currDimension) => {
        if (prevDimension) {
          const sourceNode = `${prevDimension}_${d[
            prevDimension as keyof DataType
          ]}`;
          const targetNode = `${currDimension}_${d[
            currDimension as keyof DataType
          ]}`;

          // Add nodes
          nodesSet.add(sourceNode);
          nodesSet.add(targetNode);

          // Create links
          const linkKey = `${sourceNode}->${targetNode}`;
          if (linksMap.has(linkKey)) {
            linksMap.get(linkKey)!.value += 1;
          } else {
            linksMap.set(linkKey, {
              source: sourceNode,
              target: targetNode,
              value: 1,
            });
          }
        }
        return currDimension;
      }, null as string | null);
    });

    // Convert nodes and links to arrays
    const nodesArray = Array.from(nodesSet);
    const nodes = nodesArray.map((name) => {
      const [dimension, category] = name.split('_');
      return { name, dimension, category };
    });

    const nodeMap = new Map<string, number>();
    nodes.forEach((node, index) => {
      nodeMap.set(node.name, index);
    });

    const links = Array.from(linksMap.values()).map((link) => ({
      source: nodeMap.get(link.source)!,
      target: nodeMap.get(link.target)!,
      value: link.value,
    }));

    // Create sankey diagram
    const sankeyGenerator = sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([
        [margin.left, margin.top],
        [size.width - margin.right, size.height - margin.bottom],
      ]);

    const graph = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Create a color scale for nodes based on their names
    const nodeColorScale = d3
      .scaleOrdinal<string, string>()
      .domain(nodesArray)
      .range(
        nodesArray.map((_, i) =>
          d3.interpolateRainbow(i / nodesArray.length)
        )
      );

    // Draw links with the same color as their source node
    svg
      .append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(graph.links)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke-width', (d) => Math.max(1, d.width))
      .attr('stroke', (d) => nodeColorScale((d.source as any).name))
      .attr('fill', 'none')
      .attr('opacity', 0.7);

    // Draw nodes with colors matching their names
    svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('rect')
      .data(graph.nodes)
      .enter()
      .append('rect')
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('height', (d) => Math.max(1, d.y1 - d.y0))
      .attr('width', (d) => d.x1 - d.x0)
      .attr('fill', (d) => nodeColorScale((d as any).name))
      .attr('stroke', '#000');

    // Add node labels
    svg
      .append('g')
      .selectAll('text')
      .data(graph.nodes)
      .enter()
      .append('text')
      .attr('x', (d) => d.x0 - 6)
      .attr('y', (d) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => (d as any).category)
      .filter((d) => d.x0 < size.width / 2)
      .attr('x', (d) => d.x1 + 6)
      .attr('text-anchor', 'start');

    // Add axis labels
    dimensions.forEach((dimension, index) => {
      const xPosition =
        margin.left +
        (index * (size.width - margin.left - margin.right)) /
          (dimensions.length - 1);

      svg
        .append('text')
        .attr('x', xPosition)
        .attr('y', margin.top - 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(axisLabels[index]);
    });

    // Add plot title, adjusted to prevent overlap
    svg
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', margin.top / 2) // Position title higher to avoid overlap
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Financial Risk Assessment Sankey Diagram');
  }

  return (
    <div
      ref={scatterRef}
      className="chart-container"
      style={{ width: '100%', height: '500px' }}
    >
      <svg id="parallel-coordinates-svg"></svg>
    </div>
  );
}
