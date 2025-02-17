import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  ChartTypeRegistry
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

type ChartProps = {
  data: any;
  options?: ChartOptions<keyof ChartTypeRegistry>;
};

export const BarChart = ({ data, options }: ChartProps) => (
  <Bar
    data={data}
    options={{
      ...options,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Percentual de Acerto (%)'
          }
        },
        x: {
          type: 'category',
          title: {
            display: true,
            text: 'Categorias'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        }
      }
    }}
  />
);

export const LineChart = ({ data, options }: ChartProps) => (
  <Line
    data={data}
    options={{
      ...options,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'dd/MM/yyyy',
            unit: 'day'
          },
          title: {
            display: true,
            text: 'Data'
          }
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Questões Respondidas'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        }
      }
    }}
  />
);

type PieChartProps = {
    data: any;
    options?: ChartOptions<'pie'>;
  };
  
  export const PieChart = ({ data, options }: PieChartProps) => (
    <Pie
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value}%`;
              }
            }
          }
        },
        ...options
      }}
    />
  );