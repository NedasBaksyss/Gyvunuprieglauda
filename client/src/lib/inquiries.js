export const inquiryStatuses = { new: 'Nauja', reviewed: 'Peržiūrėta', completed: 'Užbaigta' };
export const inquiryClasses = { new: 'inquiry-new', reviewed: 'inquiry-reviewed', completed: 'status-available' };
export const formatDate = (value) => new Intl.DateTimeFormat('lt', { dateStyle: 'short' }).format(new Date(value));
