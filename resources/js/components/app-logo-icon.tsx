import type { SVGProps } from 'react';

export default function AppLogoIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="currentColor"
                d="M6 4.75A2.75 2.75 0 0 1 8.75 2h10.5A1.75 1.75 0 0 1 21 3.75v14.5A1.75 1.75 0 0 1 19.25 20H8.75A2.75 2.75 0 0 1 6 17.25V4.75Zm2.75-.75A.75.75 0 0 0 8 4.75v12.5c0 .414.336.75.75.75h10.5a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25H8.75Z"
            />
            <path
                fill="currentColor"
                d="M3 6.5A2.5 2.5 0 0 1 5.5 4H8v2H5.5a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5H8v2H5.5A2.5 2.5 0 0 1 3 18.5v-12Z"
            />
        </svg>
    );
}
