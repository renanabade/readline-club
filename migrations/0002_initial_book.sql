INSERT INTO settings(id,club_name,description,community_guidelines) VALUES(1,'Clube do Livro de Computação','Um capítulo de cada vez. Uma ideia melhor quando compartilhada.','Acolha quem está começando. Pergunte sem receio, respeite os diferentes ritmos e peça autorização antes de compartilhar falas ou imagens dos encontros.');
INSERT INTO books(id,title,author,description,status) VALUES('entendendo-algoritmos','Entendendo Algoritmos','Aditya Y. Bhargava','Nossa primeira leitura: uma introdução visual e acessível aos algoritmos. Vamos conversar sobre as ideias do livro, tirar dúvidas e aprender juntos.','reading');
INSERT INTO categories(id,name) VALUES('algoritmos','Algoritmos'),('fundamentos','Fundamentos');
INSERT INTO book_categories(book_id,category_id) VALUES('entendendo-algoritmos','algoritmos'),('entendendo-algoritmos','fundamentos');
INSERT INTO reading_cycles(id,book_id,title,is_current) VALUES('primeira-leitura','entendendo-algoritmos','Nossa primeira leitura',1);

