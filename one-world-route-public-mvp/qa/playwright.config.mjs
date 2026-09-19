import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',timeout:45000,expect:{timeout:8000},fullyParallel:false,
  use:{baseURL:process.env.BASE_URL||'https://one-world-route.vercel.app',trace:'retain-on-failure',video:'retain-on-failure'},
  projects:[
    {name:'desktop',use:{viewport:{width:1440,height:900}}},
    {name:'mobile',use:{...devices['Pixel 7'],viewport:{width:412,height:915}}}
  ]
});