import { createRouter, createWebHistory } from 'vue-router';
import AboutView from '@/views/AboutView.vue';
import ActiveView from '@/views/ActiveView.vue';
import AppointmentsView from '@/views/AppointmentsView.vue';
import DischargedView from '@/views/DischargedView.vue';
import MappingView from '@/views/MappingView.vue';
import PatientDetailView from '@/views/PatientDetailView.vue';
import ReportsView from '@/views/ReportsView.vue';
import ScreeningView from '@/views/ScreeningView.vue';
import SettingsView from '@/views/SettingsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/screening',
    },
    {
      path: '/screening',
      name: 'screening',
      component: ScreeningView,
      meta: { title: 'คัดกรองผู้ป่วย' },
    },
    {
      path: '/active',
      name: 'active',
      component: ActiveView,
      meta: { title: 'ผู้ป่วยในการรักษา' },
    },
    {
      path: '/discharged',
      name: 'discharged',
      component: DischargedView,
      meta: { title: 'ผู้ป่วยจำหน่ายแล้ว' },
    },
    {
      path: '/appointments',
      name: 'appointments',
      component: AppointmentsView,
      meta: { title: 'การนัดหมาย' },
    },
    {
      path: '/patient/:hn',
      name: 'patient-detail',
      component: PatientDetailView,
      props: true,
      meta: { title: 'รายละเอียดผู้ป่วย' },
    },
    {
      path: '/mapping',
      name: 'mapping',
      component: MappingView,
      meta: { title: 'แผนที่การกระจายโรค' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: ReportsView,
      meta: { title: 'รายงาน' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { title: 'ตั้งค่า' },
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
      meta: { title: 'เกี่ยวกับโปรแกรม' },
    },
  ],
});

export default router;
