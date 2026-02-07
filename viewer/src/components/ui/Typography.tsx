import type { HTMLAttributes } from "react";

type TypographyProps = HTMLAttributes<HTMLElement>;

export function H1({ className = "", children, ...props }: TypographyProps) {
	return (
		<h1
			className={`scroll-m-20 text-4xl font-extrabold tracking-tight text-balance ${className}`}
			{...props}
		>
			{children}
		</h1>
	);
}

export function H2({ className = "", children, ...props }: TypographyProps) {
	return (
		<h2
			className={`scroll-m-20 border-b border-gray-700 pb-2 text-3xl font-semibold tracking-tight first:mt-0 ${className}`}
			{...props}
		>
			{children}
		</h2>
	);
}

export function H3({ className = "", children, ...props }: TypographyProps) {
	return (
		<h3 className={`scroll-m-20 text-2xl font-semibold tracking-tight ${className}`} {...props}>
			{children}
		</h3>
	);
}

export function H4({ className = "", children, ...props }: TypographyProps) {
	return (
		<h4 className={`scroll-m-20 text-xl font-semibold tracking-tight ${className}`} {...props}>
			{children}
		</h4>
	);
}

export function P({ className = "", children, ...props }: TypographyProps) {
	return (
		<p className={`leading-7 [&:not(:first-child)]:mt-6 ${className}`} {...props}>
			{children}
		</p>
	);
}

export function Blockquote({ className = "", children, ...props }: TypographyProps) {
	return (
		<blockquote
			className={`mt-6 border-l-2 border-gray-600 pl-6 text-gray-300 italic ${className}`}
			{...props}
		>
			{children}
		</blockquote>
	);
}

export function List({ className = "", children, ...props }: TypographyProps) {
	return (
		<ul className={`my-6 ml-6 list-disc [&>li]:mt-2 ${className}`} {...props}>
			{children}
		</ul>
	);
}

export function InlineCode({ className = "", children, ...props }: TypographyProps) {
	return (
		<code
			className={`relative rounded bg-gray-800 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className}`}
			{...props}
		>
			{children}
		</code>
	);
}

export function Lead({ className = "", children, ...props }: TypographyProps) {
	return (
		<p className={`text-xl text-gray-400 ${className}`} {...props}>
			{children}
		</p>
	);
}

export function Large({ className = "", children, ...props }: TypographyProps) {
	return (
		<div className={`text-lg font-semibold ${className}`} {...props}>
			{children}
		</div>
	);
}

export function Small({ className = "", children, ...props }: TypographyProps) {
	return (
		<small className={`text-sm leading-none font-medium ${className}`} {...props}>
			{children}
		</small>
	);
}

export function Muted({ className = "", children, ...props }: TypographyProps) {
	return (
		<p className={`text-sm text-gray-500 ${className}`} {...props}>
			{children}
		</p>
	);
}
