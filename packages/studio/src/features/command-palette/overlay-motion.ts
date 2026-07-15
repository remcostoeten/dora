export const overlayFadeMotion = [
	'will-change-opacity',
	'data-[state=open]:animate-in data-[state=closed]:animate-out',
	'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
	'data-[state=open]:duration-150 data-[state=closed]:duration-100',
	'data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]',
	'data-[state=closed]:ease-out'
].join(' ')

export const dialogContentMotion = [
	'will-change-[opacity,transform]',
	'data-[state=open]:animate-in data-[state=closed]:animate-out',
	'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
	'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
	'data-[state=open]:duration-200 data-[state=closed]:duration-150',
	'data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]',
	'data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)]'
].join(' ')
