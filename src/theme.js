import { createTheme, alpha } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#d7464f', light: '#ff737b', dark: '#a72d36' },
    secondary: { main: '#d6b36a', light: '#f3d99d', dark: '#967337' },
    background: { default: '#08090c', paper: '#111318' },
    text: { primary: '#f3f3f4', secondary: '#9a9da8' },
    divider: 'rgba(255,255,255,.075)',
    success: { main: '#47bd86' },
    warning: { main: '#d6b36a' },
    error: { main: '#e45c66' }
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'Inter, Manrope, sans-serif',
    h1: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, letterSpacing: '-.055em' },
    h2: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, letterSpacing: '-.045em' },
    h3: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, letterSpacing: '-.035em' },
    h4: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, letterSpacing: '-.03em' },
    h5: { fontFamily: 'Manrope, sans-serif', fontWeight: 750, letterSpacing: '-.025em' },
    h6: { fontFamily: 'Manrope, sans-serif', fontWeight: 750 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
    overline: { fontWeight: 800, letterSpacing: '.16em' }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, paddingInline: 17, minHeight: 42, boxShadow: 'none' },
        containedPrimary: { background: 'linear-gradient(135deg,#e35a62,#a92f3a)', boxShadow: '0 10px 28px rgba(196,55,66,.18)' }
      }
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(255,255,255,.075)', boxShadow: '0 18px 60px rgba(0,0,0,.18)' } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,.025)', '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#d7464f', .55) } }, notchedOutline: { borderColor: 'rgba(255,255,255,.10)' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 750, borderRadius: 9 } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,.065)' }, head: { color: '#878b97', fontWeight: 800, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' } } }
  }
});

export default theme;
