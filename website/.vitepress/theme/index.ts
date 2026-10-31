import DefaultTheme from 'vitepress/theme';
import TableDemo from './components/TableDemo.vue';
import ReactDemo from './components/ReactDemo.vue';
import 'edit-table/style.css';
import './custom.css';
export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: import('vue').App }): void {
    app.component('TableDemo', TableDemo);
    app.component('ReactDemo', ReactDemo);
  },
};
