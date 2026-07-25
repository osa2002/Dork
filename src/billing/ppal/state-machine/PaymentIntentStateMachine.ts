import { PPALPaymentIntentState, PPALPaymentIntentStateEnum } from "./PaymentIntentState";
import { InvalidStateTransitionException } from "../exceptions/PPALExceptions";

export class PaymentIntentStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<PPALPaymentIntentStateEnum, ReadonlyArray<PPALPaymentIntentStateEnum>> = {
    [PPALPaymentIntentStateEnum.CREATED]: [
      PPALPaymentIntentStateEnum.REQUIRES_PAYMENT_METHOD,
      PPALPaymentIntentStateEnum.REQUIRES_CONFIRMATION,
      PPALPaymentIntentStateEnum.CANCELED
    ],
    [PPALPaymentIntentStateEnum.REQUIRES_PAYMENT_METHOD]: [
      PPALPaymentIntentStateEnum.REQUIRES_CONFIRMATION,
      PPALPaymentIntentStateEnum.CANCELED
    ],
    [PPALPaymentIntentStateEnum.REQUIRES_CONFIRMATION]: [
      PPALPaymentIntentStateEnum.PROCESSING,
      PPALPaymentIntentStateEnum.REQUIRES_ACTION,
      PPALPaymentIntentStateEnum.CANCELED,
      PPALPaymentIntentStateEnum.FAILED
    ],
    [PPALPaymentIntentStateEnum.REQUIRES_ACTION]: [
      PPALPaymentIntentStateEnum.PROCESSING,
      PPALPaymentIntentStateEnum.CANCELED,
      PPALPaymentIntentStateEnum.FAILED
    ],
    [PPALPaymentIntentStateEnum.PROCESSING]: [
      PPALPaymentIntentStateEnum.REQUIRES_CAPTURE,
      PPALPaymentIntentStateEnum.SUCCEEDED,
      PPALPaymentIntentStateEnum.FAILED,
      PPALPaymentIntentStateEnum.CANCELED
    ],
    [PPALPaymentIntentStateEnum.REQUIRES_CAPTURE]: [
      PPALPaymentIntentStateEnum.SUCCEEDED,
      PPALPaymentIntentStateEnum.CANCELED,
      PPALPaymentIntentStateEnum.FAILED
    ],
    [PPALPaymentIntentStateEnum.SUCCEEDED]: [],
    [PPALPaymentIntentStateEnum.CANCELED]: [],
    [PPALPaymentIntentStateEnum.FAILED]: []
  };

  public canTransition(from: PPALPaymentIntentState, to: PPALPaymentIntentState): boolean {
    const allowed = PaymentIntentStateMachine.ALLOWED_TRANSITIONS[from.value] || [];
    return allowed.includes(to.value);
  }

  public transition(from: PPALPaymentIntentState, to: PPALPaymentIntentState): PPALPaymentIntentState {
    if (!this.canTransition(from, to)) {
      throw new InvalidStateTransitionException(
        `Invalid payment intent state transition from '${from.value}' to '${to.value}'.`
      );
    }
    return to;
  }
}
