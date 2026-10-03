const SECTION_ROLES = {
  dashboard: ['ADMIN', 'OPERATOR', 'VIEWER'],
  monitoring: ['ADMIN', 'OPERATOR', 'VIEWER'],
  alerts: ['ADMIN', 'OPERATOR'],
  'fan-control': ['ADMIN', 'OPERATOR'],
  'onion-analysis': ['ADMIN', 'OPERATOR'],
  reports: ['ADMIN', 'VIEWER'],
  settings: ['ADMIN'],
};

export function canAccessSection(role, section) {
  return SECTION_ROLES[section]?.includes(role) ?? false;
}

export function roleLabel(role) {
  return ({ ADMIN: 'Administrator', OPERATOR: 'Operator', VIEWER: 'Viewer' })[role] || 'User';
}
