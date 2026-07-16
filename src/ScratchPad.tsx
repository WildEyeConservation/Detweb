import { JobsRemaining } from './JobsRemaining';
import SqsPreloader from './SqsPreloader';

export function ScratchPad() {
  return (
    <div
      className='d-flex flex-column align-items-center gap-3 w-100 h-100'
      style={{ paddingTop: '12px', paddingBottom: '12px' }}
    >
      <div className={'w-100 h-100'}>
        <SqsPreloader />
      </div>
      <JobsRemaining />
    </div>
  );
}

export default ScratchPad;
