import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2b75a7',
      dark: '#184a7b',
      light: '#5a9ec7',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#172b51',
      dark: '#0d1a30',
      light: '#2d4570',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F8F9FA',
      paper: '#ffffff',
    },
    text: {
      primary: '#172b51',
      secondary: '#6B7280',
    },
    success: {
      main: '#10B981',
      light: '#D1FAE5',
      dark: '#065F46',
    },
    error: {
      main: '#DC2626',
      light: '#FEE2E2',
      dark: '#991B1B',
    },
    warning: {
      main: '#F59E0B',
      light: '#FED7AA',
      dark: '#92400E',
    },
    info: {
      main: '#3B82F6',
      light: '#DBEAFE',
      dark: '#1E40AF',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      '"Fira Sans"',
      '"Droid Sans"',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
          fontWeight: 600,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          border: '1px solid #E5E7EB',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: '#2b75a7',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '1rem',
        },
      },
    },
  },
});

export default theme;
