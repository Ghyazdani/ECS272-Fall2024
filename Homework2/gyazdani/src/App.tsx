import React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import BarChartOverview from './components/BarChartOverview';
import ScatterPlot from './components/HexbinPlot';
import ParallelCoordinatesPlot from './components/ParallelCoordinatesPlot';

// Adjust the color theme for Material UI
const theme = createTheme({
  palette: {
    primary: {
      main: grey[700],
    },
    secondary: {
      main: grey[700],
    },
  },
});

const Layout = () => (
  <Grid container id="main-layout" style={{ height: '100%' }}>
    {/* Bar Chart Container */}
    <Grid item xs={12} md={6} id="bar-chart-container" style={{ height: '100%' }}>
      <BarChartOverview />
    </Grid>

    {/* Container for the Two Stacked Charts */}
    <Grid item xs={12} md={6} id="stacked-charts-container" style={{ height: '100%' }}>
      <Box display="flex" flexDirection="column" height="100%">
        <Box flex={1}>
          <ScatterPlot />
        </Box>
        <Box flex={1}>
          <ParallelCoordinatesPlot />
        </Box>
      </Box>
    </Grid>
  </Grid>
);

const Dashboard = () => {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      {/* Title Section */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>ECS 271: Homework 2</h1>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'normal', margin: '5px 0' }}>By: Giselle Yazdani</h2>
      </div>

      {/* Dashboard Layout */}
      <div style={{ height: 'calc(100% - 80px)' }}> {/* Adjusted height to accommodate title */}
        <Layout />
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>
  );
}

export default App;
