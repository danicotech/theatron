import { BrandMark } from '../chrome/BrandMark';
import styles from './MemberScroll.module.css';

export function MemberSeal() {
  return (
    <span data-member-seal>
      <BrandMark className={styles.seal ?? ''} />
    </span>
  );
}
