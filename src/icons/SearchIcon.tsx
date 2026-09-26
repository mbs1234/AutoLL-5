import Icon, { IconProps } from './Icon';

/**
 * A magnifier, for the NextLL tab. Its tab used the drop arrow, which on the
 * LL tab means an upcoming drop.
 */
export default function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        d="M6.5 1a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
      />
    </Icon>
  );
}
