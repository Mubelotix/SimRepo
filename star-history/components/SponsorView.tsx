import { useEffect, useState } from "react";
import { randomSponsors } from "../helpers/sponsor";
import Link from 'next/link';

type Sponsor = {
  className?: string;
};

const BytebaseBanner: React.FC<Sponsor> = ({ className }) => {
  const [isClient, setIsClient] = useState(false);
  const sponsor = isClient ? randomSponsors[0] : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!sponsor) {
    return null; // or a loading state if needed
  }

  return (
    <div className={`w-full px-3 max-w-3xl mx-auto flex flex-col justify-center items-center text-center ${className}`}>
      <div className="w-full mb-6 flex flex-col justify-center items-center">
        <p className="mb-2 text-sm text-gray-600">
          <Link href={sponsor.link}>
            <a className="text-blue-500 hover:opacity-80 underline" target="_blank">
              {sponsor.name}
            </a>
          </Link>
          - {sponsor.logoSlogan}
        </p>
        <Link href={sponsor.link}>
          <a className="hover:opacity-80" target="_blank">
            <img className="w-auto max-w-full" src={sponsor.landingImage} alt={sponsor.name} />
          </a>
        </Link>
      </div>
    </div>
  );
 }

export default BytebaseBanner;