import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/ticket_dto.dart';

abstract class TicketFirestoreDataSource {
  /// Stream real-time snapshot of document at `/tickets/{ticketId}`
  Stream<TicketDto?> watchTicket(String ticketId);
}

class TicketFirestoreDataSourceImpl implements TicketFirestoreDataSource {
  final FirebaseFirestore _firestore;

  TicketFirestoreDataSourceImpl({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  @override
  Stream<TicketDto?> watchTicket(String ticketId) {
    if (ticketId.isEmpty) return Stream.value(null);

    // CANONICAL PATH: /tickets/{ticketId}
    return _firestore
        .collection('tickets')
        .doc(ticketId)
        .snapshots()
        .map((snapshot) {
      if (!snapshot.exists || snapshot.data() == null) {
        return null;
      }
      return TicketDto.fromJson(snapshot.data()!, snapshot.id);
    });
  }
}
