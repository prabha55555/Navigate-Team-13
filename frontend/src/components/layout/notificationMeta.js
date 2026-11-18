import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GradingOutlinedIcon from '@mui/icons-material/GradingOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

const META = {
  'assessment.published': { Icon: CampaignOutlinedIcon, tone: 'primary' },
  'results.released': { Icon: AssignmentTurnedInOutlinedIcon, tone: 'success' },
  'submission.received': { Icon: InboxOutlinedIcon, tone: 'info' },
  'submission.graded': { Icon: GradingOutlinedIcon, tone: 'success' },
  'member.joined': { Icon: PersonAddAlt1OutlinedIcon, tone: 'primary' },
  'member.role_changed': { Icon: ManageAccountsOutlinedIcon, tone: 'info' },
  'plan.limit_reached': { Icon: WarningAmberRoundedIcon, tone: 'warning' },
  'plan.upgrade_requested': { Icon: CreditCardOutlinedIcon, tone: 'secondary' },
  'plan.changed': { Icon: CreditCardOutlinedIcon, tone: 'secondary' },
};

/** Icon + palette tone for a notification type. */
export const notificationMeta = (type = '') => {
  if (META[type]) return META[type];
  if (type.startsWith('plan.')) return { Icon: WarningAmberRoundedIcon, tone: 'warning' };
  return { Icon: NotificationsNoneRoundedIcon, tone: 'primary' };
};

/** Only follow in-app links. */
export const safeInternalLink = (link) => (typeof link === 'string' && /^\/(?!\/)/.test(link) ? link : null);
