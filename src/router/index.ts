import { createRouter, createWebHistory } from 'vue-router';

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
      component: () => import('@/views/ScreeningView.vue'),
      meta: { title: 'คัดกรองผู้ป่วย' },
    },
    {
      path: '/active',
      name: 'active',
      component: () => import('@/views/ActiveView.vue'),
      meta: { title: 'ผู้ป่วยในการรักษา' },
    },
    {
      path: '/discharged',
      name: 'discharged',
      component: () => import('@/views/DischargedView.vue'),
      meta: { title: 'ผู้ป่วยจำหน่ายแล้ว' },
    },
    {
      path: '/appointments',
      name: 'appointments',
      component: () => import('@/views/AppointmentsView.vue'),
      meta: { title: 'การนัดหมาย' },
    },
    {
      path: '/dosage-assessment',
      name: 'dosage-assessment',
      component: () => import('@/views/DosageAssessmentView.vue'),
      meta: { title: 'การประเมินขนาดยา' },
    },
    {
      path: '/patient/:hn',
      name: 'patient-detail',
      component: () => import('@/views/PatientDetailView.vue'),
      props: true,
      meta: { title: 'รายละเอียดผู้ป่วย' },
    },
    {
      path: '/mapping',
      name: 'mapping',
      component: () => import('@/views/MappingView.vue'),
      meta: { title: 'แผนที่การกระจายโรค' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('@/views/ReportsView.vue'),
      meta: { title: 'รายงาน' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'ตั้งค่า' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: 'เกี่ยวกับโปรแกรม' },
    },
  ],
});

export default router;
